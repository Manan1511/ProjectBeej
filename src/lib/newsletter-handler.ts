import { createHmac } from "node:crypto";
import { newsletterInputSchema } from "@/lib/newsletter-validation";
import { subscribeWithConsent } from "@/lib/newsletter";
import { consumeDurableRateLimit } from "@/lib/tracking-store";

type Dependencies = {
  rateLimit: (key: string) => Promise<boolean>;
  subscribe: (email: string) => Promise<void>;
  secret: () => string;
};

const defaults: Dependencies = {
  rateLimit: consumeDurableRateLimit,
  subscribe: subscribeWithConsent,
  secret: () => {
    const secret = process.env.TRACKING_SIGNING_SECRET || "";
    if (secret.length < 32) throw new Error("Newsletter endpoint is not configured.");
    return secret;
  },
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleNewsletterSubmission(request: Request, trustedIp?: string | null, deps: Dependencies = defaults): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 4096) return json({ error: "Sign-up request is too large." }, 413);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Enter a valid email address." }, 400); }
  if (JSON.stringify(body).length > 4096) return json({ error: "Sign-up request is too large." }, 413);
  if (body && typeof body === "object" && "company" in body && typeof body.company === "string" && body.company.length > 0) return json({ success: true });

  const parsed = newsletterInputSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Enter a valid email and choose the email updates checkbox." }, 400);
  try {
    const secret = deps.secret();
    const network = trustedIp && /^[0-9a-fA-F:.]{2,64}$/.test(trustedIp) ? trustedIp : `email:${parsed.data.email}`;
    const key = createHmac("sha256", secret).update(network.toLowerCase()).digest("hex");
    if (!await deps.rateLimit(key)) return json({ error: "Too many sign-up attempts. Try again in a minute." }, 429);
    await deps.subscribe(parsed.data.email);
    return json({ success: true });
  } catch {
    return json({ error: "Email sign-up is temporarily unavailable. Please try again later." }, 503);
  }
}
