export function getPublicSiteUrl(): string | undefined {
  const configured = process.env.SITE_URL?.trim();
  if (!configured) return undefined;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
