import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_DURATION_MS,
  createAdminPasswordHash,
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "./admin-auth-core";

describe("admin owner password and session tokens", () => {
  it("stores owner passwords using a random salted scrypt hash", async () => {
    const first = await createAdminPasswordHash("correct horse battery staple");
    const second = await createAdminPasswordHash("correct horse battery staple");

    expect(first).not.toBe(second);
    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    await expect(verifyAdminPassword("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong password", first)).resolves.toBe(false);
  });

  it("expires the signed session after eight hours and rejects tampering", () => {
    const passwordHash = "scrypt$16384$8$1$salt$key";
    const secret = "test-signing-secret-that-is-at-least-thirty-two-bytes";
    const now = 1_800_000_000_000;
    const token = createAdminSessionToken(passwordHash, secret, now);

    expect(ADMIN_SESSION_DURATION_MS).toBe(8 * 60 * 60 * 1000);
    expect(verifyAdminSessionToken(token, passwordHash, secret, now + 1000)).toBe(true);
    expect(verifyAdminSessionToken(token, passwordHash, secret, now + ADMIN_SESSION_DURATION_MS + 1)).toBe(false);
    expect(verifyAdminSessionToken(`${token}x`, passwordHash, secret, now + 1000)).toBe(false);
  });

  it("invalidates existing sessions when the owner password hash changes", () => {
    const secret = "test-signing-secret-that-is-at-least-thirty-two-bytes";
    const token = createAdminSessionToken("password-hash-one", secret, 1_800_000_000_000);

    expect(verifyAdminSessionToken(token, "password-hash-two", secret, 1_800_000_000_001)).toBe(false);
  });

  it("refuses undersized session signing secrets", () => {
    expect(() => createAdminSessionToken("hash", "short", 1_800_000_000_000)).toThrow("Admin session signing secret is not configured.");
  });
});
