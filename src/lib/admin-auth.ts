import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth-handler";
import {
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/admin-auth-core";
import { consumeDurableRateLimit } from "@/lib/tracking-store";
import { requestBuyerIp } from "@/lib/request-ip";

const HASH_FORMAT = /^scrypt\$16384\$8\$1\$[a-f\d]{32}\$[a-f\d]{128}$/;

export function getAdminAuthConfig() {
  const passwordHash = process.env.ADMIN_OWNER_PASSWORD_HASH || "";
  const sessionSecret = process.env.ADMIN_SESSION_SECRET || "";
  if (!HASH_FORMAT.test(passwordHash) || Buffer.byteLength(sessionSecret, "utf8") < 32) return null;
  return { passwordHash, sessionSecret };
}

export async function isAdminRequestAuthenticated(request: Request): Promise<boolean> {
  const config = getAdminAuthConfig();
  if (!config) return false;
  const part = (request.headers.get("cookie") || "").split(";").map((value) => value.trim())
    .find((value) => value.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (!part) return false;
  let token: string;
  try { token = decodeURIComponent(part.slice(ADMIN_SESSION_COOKIE.length + 1)); } catch { return false; }
  return verifyAdminSessionToken(token, config.passwordHash, config.sessionSecret);
}

export async function isCurrentAdminAuthenticated(): Promise<boolean> {
  const config = getAdminAuthConfig();
  if (!config) return false;
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return Boolean(token && verifyAdminSessionToken(token, config.passwordHash, config.sessionSecret));
}

export async function createAdminAuthDependencies() {
  return {
    getConfig: getAdminAuthConfig,
    verifyPassword: verifyAdminPassword,
    rateLimit: consumeDurableRateLimit,
    clientIp: requestBuyerIp,
    now: Date.now,
    isProduction: () => process.env.NODE_ENV === "production" || process.env.CONTEXT === "production",
    createSession: createAdminSessionToken,
    verifySession: (token: string, config: { passwordHash: string; sessionSecret: string }, now: number) =>
      verifyAdminSessionToken(token, config.passwordHash, config.sessionSecret, now),
  };
}
