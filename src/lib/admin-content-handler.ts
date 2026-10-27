import { parseAdminContent } from "@/lib/admin-content";
import { isSameOriginAdminRequest } from "@/lib/admin-origin";
import {
  AdminContentStoreError,
  discardAdminDraft,
  getAdminContentState,
  publishAdminDraft,
  saveAdminDraft,
  type AdminContentStore,
} from "@/lib/admin-content-store";

export type AdminContentApiDependencies = {
  isAuthenticated: (request: Request) => Promise<boolean>;
  getStore: () => AdminContentStore;
  now: () => string;
};

export type AdminContentAction = "read" | "save" | "discard" | "publish";
const MAX_CONTENT_BYTES = 32_768;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function statusFor(error: unknown): number {
  if (error instanceof AdminContentStoreError) {
    if (error.code === "conflict") return 409;
    if (error.code === "not-found") return 404;
    if (error.code === "invalid") return 422;
  }
  return 503;
}

function safeMessage(error: unknown): string {
  return error instanceof AdminContentStoreError ? error.message : "Shopify content could not be updated. Try again.";
}

async function readBody(request: Request): Promise<unknown | null> {
  if (Number(request.headers.get("content-length") || 0) > MAX_CONTENT_BYTES) return null;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_CONTENT_BYTES) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

export async function handleAdminContentRequest(request: Request, action: AdminContentAction, deps: AdminContentApiDependencies): Promise<Response> {
  if (!await deps.isAuthenticated(request)) return json({ error: "Admin sign-in is required." }, 401);

  if (action === "read") {
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    try { return json(await getAdminContentState(deps.getStore())); }
    catch (error) { return json({ error: safeMessage(error) }, statusFor(error)); }
  }

  if (!isSameOriginAdminRequest(request)) return json({ error: "Invalid request origin." }, 403);
  const expectedMethod = action === "save" ? "PUT" : "POST";
  if (request.method !== expectedMethod) return json({ error: "Method not allowed." }, 405);

  if (action === "save") {
    const body = await readBody(request);
    if (body === null) return json({ error: "Enter valid content under 32 KB." }, 400);
    const parsed = parseAdminContent(body);
    if (!parsed.success) return json({ error: "Fix the highlighted fields before saving.", errors: parsed.errors }, 422);
    try { return json(await saveAdminDraft(deps.getStore(), parsed.data, deps.now())); }
    catch (error) { return json({ error: safeMessage(error) }, statusFor(error)); }
  }

  try {
    if (action === "discard") return json(await discardAdminDraft(deps.getStore(), deps.now()));
    const result = await publishAdminDraft(deps.getStore(), deps.now());
    return json({ ...result.state, changedSections: result.changedSections });
  } catch (error) {
    return json({ error: safeMessage(error) }, statusFor(error));
  }
}
