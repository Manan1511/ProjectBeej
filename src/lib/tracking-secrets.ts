export const TRACKING_CONTEXT_COOKIE = "beej-tracking-context";

export function trackingSigningSecret(): string {
  const secret = process.env.TRACKING_SIGNING_SECRET || "";
  if (secret.length < 32) throw new Error("TRACKING_SIGNING_SECRET must contain at least 32 characters.");
  return secret;
}
