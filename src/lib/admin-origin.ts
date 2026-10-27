export function isSameOriginAdminRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const incomingUrl = new URL(request.url);
    const originUrl = new URL(origin);
    const host = request.headers.get("host")?.trim()
      || request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
      || incomingUrl.host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const protocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, "")}:` : incomingUrl.protocol;

    if (protocol !== "http:" && protocol !== "https:") return false;
    return originUrl.origin === new URL(`${protocol}//${host}`).origin;
  } catch {
    return false;
  }
}
