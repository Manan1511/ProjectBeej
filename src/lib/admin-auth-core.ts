import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_BYTES = 64;

type SessionPayload = { version: 1; issuedAt: number; expiresAt: number; credentialVersion: string };

function derivePasswordKey(password: string, salt: Buffer, cost = SCRYPT_COST): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_BYTES, {
      N: cost,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
      maxmem: 64 * 1024 * 1024,
    }, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
}

export async function createAdminPasswordHash(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) throw new Error("Choose a password between 12 and 128 characters.");
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyAdminPassword(password: string, encodedHash: string): Promise<boolean> {
  const match = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([a-f\d]{32})\$([a-f\d]{128})$/.exec(encodedHash);
  if (!match || password.length > 128) return false;
  const [, costText, blockSizeText, parallelText, saltText, expectedText] = match;
  if (Number(costText) !== SCRYPT_COST || Number(blockSizeText) !== SCRYPT_BLOCK_SIZE || Number(parallelText) !== SCRYPT_PARALLELIZATION) return false;
  try {
    const actual = await derivePasswordKey(password, Buffer.from(saltText, "hex"));
    const expected = Buffer.from(expectedText, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function credentialVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 24);
}

function sessionSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function assertSessionSecret(secret: string): void {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Admin session signing secret is not configured.");
}

export function createAdminSessionToken(passwordHash: string, secret: string, now = Date.now()): string {
  assertSessionSecret(secret);
  const payload: SessionPayload = {
    version: 1,
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_DURATION_MS,
    credentialVersion: credentialVersion(passwordHash),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sessionSignature(encoded, secret)}`;
}

export function verifyAdminSessionToken(token: string, passwordHash: string, secret: string, now = Date.now()): boolean {
  try {
    if (Buffer.byteLength(secret, "utf8") < 32 || token.length > 2048) return false;
    const [encoded, suppliedSignature, extra] = token.split(".");
    if (!encoded || !suppliedSignature || extra !== undefined) return false;
    const expectedSignature = Buffer.from(sessionSignature(encoded, secret));
    const actualSignature = Buffer.from(suppliedSignature);
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return false;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SessionPayload>;
    return payload.version === 1
      && Number.isSafeInteger(payload.issuedAt)
      && Number.isSafeInteger(payload.expiresAt)
      && (payload.issuedAt as number) <= now + 60_000
      && (payload.expiresAt as number) - (payload.issuedAt as number) === ADMIN_SESSION_DURATION_MS
      && (payload.expiresAt as number) > now
      && payload.credentialVersion === credentialVersion(passwordHash);
  } catch {
    return false;
  }
}
