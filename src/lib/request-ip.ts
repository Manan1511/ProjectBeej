import { headers } from "next/headers";

export async function requestBuyerIp(): Promise<string | undefined> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const realIp = requestHeaders.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp;
  if (!candidate || candidate.length > 64 || !/^[0-9a-fA-F:.]+$/.test(candidate)) return undefined;
  return candidate;
}
