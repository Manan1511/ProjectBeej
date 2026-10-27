import { createHmac } from "node:crypto";
import { isSameOriginAdminRequest } from "@/lib/admin-origin";

export type AdminAuthConfig = { passwordHash: string; sessionSecret: string };
export type AdminAuthDependencies = {
  getConfig: () => AdminAuthConfig | null;
  verifyPassword: (password: string, encodedHash: string) => Promise<boolean>;
  rateLimit: (bucketKey: string) => Promise<boolean>;
  clientIp: () => Promise<string | null | undefined>;
  now: () => number;
  isProduction: () => boolean;
  createSession: (passwordHash: string, secret: string, now: number) => string;
  verifySession: (token: string, config: AdminAuthConfig, now: number) => boolean;
};

export const ADMIN_SESSION_COOKIE = "beej_admin_session";
const ADMIN_SESSION_AGE_SECONDS = 8 * 60 * 60;
const MAX_LOGIN_BODY_BYTES = 4_096;

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", ...Object.fromEntries(new Headers(headers).entries()) } });
}

function cookieToken(request: Request): string {
  const cookie = request.headers.get("cookie") || "";
  const part = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (!part) return "";
  try { return decodeURIComponent(part.slice(ADMIN_SESSION_COOKIE.length + 1)); } catch { return ""; }
}

function sessionCookie(value: string, secure: boolean, maxAge: number): string {
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

function rateLimitKey(secret: string, clientIp: string | null | undefined): string {
  const validIp = clientIp && clientIp.length <= 64 && /^[0-9a-fA-F:.]+$/.test(clientIp) ? clientIp.toLowerCase() : "unknown";
  return createHmac("sha256", secret).update(`admin-login:${validIp}`).digest("hex");
}

export async function handleAdminSessionRequest(request: Request, deps: AdminAuthDependencies): Promise<Response> {
  if (request.method === "GET") {
    const config = deps.getConfig();
    const token = cookieToken(request);
    return json({ configured: Boolean(config), authenticated: Boolean(config && token && deps.verifySession(token, config, deps.now())) });
  }

  if (request.method === "DELETE") {
    if (!isSameOriginAdminRequest(request)) return json({ error: "Invalid request origin." }, 403);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", deps.isProduction(), 0) });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE" });
  if (!isSameOriginAdminRequest(request)) return json({ error: "Invalid request origin." }, 403);

  const config = deps.getConfig();
  if (!config) return json({ error: "Admin sign-in is not configured. Set the owner password and session secret." }, 503);
  if (Number(request.headers.get("content-length") || 0) > MAX_LOGIN_BODY_BYTES) return json({ error: "Sign-in request is too large." }, 413);

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_LOGIN_BODY_BYTES) return json({ error: "Sign-in request is too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Enter the admin password." }, 400);
  }
  const password = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).password : undefined;
  if (typeof password !== "string" || password.length === 0 || password.length > 128) return json({ error: "Enter a valid admin password." }, 400);

  try {
    if (!await deps.rateLimit(rateLimitKey(config.sessionSecret, await deps.clientIp()))) {
      return json({ error: "Too many sign-in attempts. Wait a minute, then try again." }, 429);
    }
  } catch {
    return json({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
  }

  if (!await deps.verifyPassword(password, config.passwordHash)) return json({ error: "That password did not match." }, 401);
  const token = deps.createSession(config.passwordHash, config.sessionSecret, deps.now());
  return json({ authenticated: true }, 200, { "Set-Cookie": sessionCookie(token, deps.isProduction(), ADMIN_SESSION_AGE_SECONDS) });
}
