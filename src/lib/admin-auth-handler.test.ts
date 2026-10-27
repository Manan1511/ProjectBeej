import { describe, expect, it, vi } from "vitest";
import { handleAdminSessionRequest, type AdminAuthDependencies } from "./admin-auth-handler";

const config = { passwordHash: "test-password-hash", sessionSecret: "test-session-signing-secret-that-is-long-enough" };

function dependencies(overrides: Partial<AdminAuthDependencies> = {}) {
  const base: AdminAuthDependencies = {
    getConfig: () => config,
    verifyPassword: vi.fn(async (password) => password === "correct horse battery staple"),
    rateLimit: vi.fn(async () => true),
    clientIp: async () => "203.0.113.5",
    now: () => 1_800_000_000_000,
    isProduction: () => true,
    createSession: () => "signed-session-token",
    verifySession: (token) => token === "signed-session-token",
  };
  return { deps: { ...base, ...overrides } };
}

function post(body: unknown, origin = "https://store.example") {
  return new Request("https://store.example/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("owner admin session handler", () => {
  it("sets an eight-hour HttpOnly secure cookie after a valid owner login", async () => {
    const fixture = dependencies();
    const response = await handleAdminSessionRequest(post({ password: "correct horse battery staple" }), fixture.deps);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("beej_admin_session=signed-session-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=28800");
  });

  it("accepts the public same-origin host when Next uses an internal request URL", async () => {
    const fixture = dependencies();
    const request = new Request("http://0.0.0.0:3012/api/admin/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3012",
        host: "localhost:3012",
        "x-forwarded-host": "localhost:3012",
        "x-forwarded-proto": "http",
      },
      body: JSON.stringify({ password: "correct horse battery staple" }),
    });

    const response = await handleAdminSessionRequest(request, fixture.deps);

    expect(response.status).toBe(200);
  });

  it("rejects a bad origin before checking credentials", async () => {
    const fixture = dependencies();
    const response = await handleAdminSessionRequest(post({ password: "correct horse battery staple" }, "https://attacker.example"), fixture.deps);

    expect(response.status).toBe(403);
    expect(fixture.deps.rateLimit).not.toHaveBeenCalled();
  });

  it("returns an authentication error for an incorrect password", async () => {
    const fixture = dependencies();
    const response = await handleAdminSessionRequest(post({ password: "wrong password" }), fixture.deps);

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("throttles before verifying the password and fails closed if the durable limiter is unavailable", async () => {
    const blocked = dependencies({ rateLimit: vi.fn(async () => false) });
    const blockedResponse = await handleAdminSessionRequest(post({ password: "correct horse battery staple" }), blocked.deps);
    expect(blockedResponse.status).toBe(429);
    expect(blocked.deps.verifyPassword).not.toHaveBeenCalled();

    const unavailable = dependencies({ rateLimit: vi.fn(async () => { throw new Error("db unavailable"); }) });
    const unavailableResponse = await handleAdminSessionRequest(post({ password: "correct horse battery staple" }), unavailable.deps);
    expect(unavailableResponse.status).toBe(503);
  });

  it("reports session state without returning a session token", async () => {
    const fixture = dependencies();
    const unauthenticated = await handleAdminSessionRequest(new Request("https://store.example/api/admin/session"), fixture.deps);
    const authenticated = await handleAdminSessionRequest(new Request("https://store.example/api/admin/session", { headers: { cookie: "beej_admin_session=signed-session-token" } }), fixture.deps);

    expect(await unauthenticated.json()).toEqual({ configured: true, authenticated: false });
    expect(await authenticated.json()).toEqual({ configured: true, authenticated: true });
    expect(authenticated.headers.get("cache-control")).toContain("no-store");
  });

  it("requires same origin to log out and clears the session cookie", async () => {
    const fixture = dependencies();
    const invalid = await handleAdminSessionRequest(new Request("https://store.example/api/admin/session", { method: "DELETE", headers: { origin: "https://attacker.example" } }), fixture.deps);
    const valid = await handleAdminSessionRequest(new Request("https://store.example/api/admin/session", { method: "DELETE", headers: { origin: "https://store.example" } }), fixture.deps);

    expect(invalid.status).toBe(403);
    expect(valid.status).toBe(200);
    expect(valid.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
