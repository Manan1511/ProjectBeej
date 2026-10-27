import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_CONTENT } from "./admin-content";
import {
  AdminContentStoreError,
  type AdminContentStore,
  type AdminContentStoreSnapshot,
  type AdminMetafieldWrite,
} from "./admin-content-store";
import { handleAdminContentRequest, type AdminContentApiDependencies } from "./admin-content-handler";

function fixture(overrides: Partial<AdminContentApiDependencies> = {}) {
  const writes: AdminMetafieldWrite[][] = [];
  const snapshot: AdminContentStoreSnapshot = {
    shopId: "gid://shopify/Shop/1",
    appInstallationId: "gid://shopify/AppInstallation/2",
    published: null,
    draft: null,
  };
  const store: AdminContentStore = {
    read: async () => snapshot,
    setMetafields: async (value) => { writes.push(value); },
  };
  const base: AdminContentApiDependencies = {
    isAuthenticated: async () => true,
    getStore: () => store,
    now: () => "2026-10-21T13:00:00.000Z",
  };
  return { deps: { ...base, ...overrides }, store, writes };
}

function request(method: string, body?: unknown, origin = "https://store.example") {
  return new Request("https://store.example/api/admin/content", {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(origin ? { origin } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("authenticated admin content API", () => {
  it("requires an authenticated owner and marks responses private", async () => {
    const fixtureState = fixture({ isAuthenticated: async () => false });
    const response = await handleAdminContentRequest(request("GET"), "read", fixtureState.deps);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fixtureState.writes).toHaveLength(0);
  });

  it("rejects cross-origin draft writes before touching Shopify", async () => {
    const fixtureState = fixture();
    const response = await handleAdminContentRequest(request("PUT", DEFAULT_ADMIN_CONTENT, "https://attacker.example"), "save", fixtureState.deps);

    expect(response.status).toBe(403);
    expect(fixtureState.writes).toHaveLength(0);
  });

  it("accepts same-origin draft writes behind Next's internal host", async () => {
    const fixtureState = fixture();
    const internalRequest = new Request("http://0.0.0.0:3012/api/admin/content", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3012",
        host: "localhost:3012",
        "x-forwarded-host": "localhost:3012",
        "x-forwarded-proto": "http",
      },
      body: JSON.stringify(DEFAULT_ADMIN_CONTENT),
    });
    const response = await handleAdminContentRequest(internalRequest, "save", fixtureState.deps);

    expect(response.status).toBe(200);
    expect(fixtureState.writes).toHaveLength(1);
  });

  it("returns field-level validation errors and does not save invalid content", async () => {
    const fixtureState = fixture();
    const invalid = structuredClone(DEFAULT_ADMIN_CONTENT);
    invalid.contactEmail = "bad";
    const response = await handleAdminContentRequest(request("PUT", invalid), "save", fixtureState.deps);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ errors: { contactEmail: expect.any(String) } });
    expect(fixtureState.writes).toHaveLength(0);
  });

  it("keeps authentication responses from revealing an unpublished draft", async () => {
    const fixtureState = fixture();
    const response = await handleAdminContentRequest(request("GET"), "read", fixtureState.deps);
    const body = await response.json();

    expect(body).toMatchObject({ published: DEFAULT_ADMIN_CONTENT, draft: DEFAULT_ADMIN_CONTENT, hasDraft: false });
    expect(body).not.toHaveProperty("compareDigest");
  });

  it("returns conflict separately from an unavailable Shopify write", async () => {
    const conflictState = fixture({
      getStore() {
        return { ...fixture().store, setMetafields: async () => { throw new AdminContentStoreError("conflict", "changed elsewhere"); } };
      },
    });
    const conflict = await handleAdminContentRequest(request("PUT", { ...DEFAULT_ADMIN_CONTENT, announcement: "Updated" }), "save", conflictState.deps);

    expect(conflict.status).toBe(409);
  });
});
