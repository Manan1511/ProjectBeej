import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_CONTENT, mergeAdminContent, stableContentHash } from "./admin-content";
import {
  AdminContentStoreError,
  discardAdminDraft,
  publishAdminDraft,
  saveAdminDraft,
  type AdminContentStore,
  type AdminMetafieldSnapshot,
  type AdminMetafieldWrite,
} from "./admin-content-store";

function memoryStore(initialSettings: Record<string, unknown> = {}): AdminContentStore & {
  writes: AdminMetafieldWrite[][];
  forceTimeoutAfterWrite: boolean;
  setExternalSettings(value: Record<string, unknown>): void;
} {
  let live: AdminMetafieldSnapshot | null = { value: JSON.stringify(initialSettings), compareDigest: stableContentHash(initialSettings) };
  let draft: AdminMetafieldSnapshot | null = null;
  let digestCounter = 0;
  const store = {
    writes: [] as AdminMetafieldWrite[][],
    forceTimeoutAfterWrite: false,
    setExternalSettings(value: Record<string, unknown>) {
      live = { value: JSON.stringify(value), compareDigest: `external-${++digestCounter}` };
    },
    async read() {
      return {
        shopId: "gid://shopify/Shop/1",
        appInstallationId: "gid://shopify/AppInstallation/2",
        published: live ? { ...live } : null,
        draft: draft ? { ...draft } : null,
      };
    },
    async setMetafields(writes: AdminMetafieldWrite[]) {
      store.writes.push(writes);
      const currentFor = (write: AdminMetafieldWrite) => write.key === "storefront_settings" ? live : draft;
      if (writes.some((write) => (currentFor(write)?.compareDigest ?? null) !== write.compareDigest)) {
        throw new AdminContentStoreError("conflict", "Shopify content changed in another session.");
      }
      for (const write of writes) {
        const next = { value: write.value, compareDigest: `memory-${++digestCounter}` };
        if (write.key === "storefront_settings") live = next;
        else draft = next;
      }
      if (store.forceTimeoutAfterWrite) {
        store.forceTimeoutAfterWrite = false;
        throw new Error("Connection timed out after Shopify committed the write.");
      }
    },
  };
  return store;
}

describe("Shopify-backed admin drafts and publishing", () => {
  it("saves a private draft without creating or changing the published Shop metafield", async () => {
    const store = memoryStore({ legacySetting: "keep me" });
    const content = structuredClone(DEFAULT_ADMIN_CONTENT);
    content.visibility.homeAthletes = false;

    const state = await saveAdminDraft(store, content, "2026-10-21T10:00:00.000Z");

    expect(state.draft.visibility.homeAthletes).toBe(false);
    expect(state.hasDraft).toBe(true);
    expect((await store.read()).published?.value).toBe(JSON.stringify({ legacySetting: "keep me" }));
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]).toHaveLength(1);
    expect(store.writes[0][0]).toMatchObject({ key: "storefront_content_draft", compareDigest: null });
  });

  it("discards a draft back to the published settings", async () => {
    const store = memoryStore({ announcement: "Live announcement" });
    const content = structuredClone(DEFAULT_ADMIN_CONTENT);
    content.announcement = "Draft announcement";
    await saveAdminDraft(store, content);

    const state = await discardAdminDraft(store, "2026-10-21T10:05:00.000Z");

    expect(state.hasDraft).toBe(false);
    expect(state.draft.announcement).toBe("Live announcement");
  });

  it("allows a saved draft to be reset to the currently published content", async () => {
    const store = memoryStore();
    const changed = structuredClone(DEFAULT_ADMIN_CONTENT);
    changed.visibility.homeAthletes = false;
    await saveAdminDraft(store, changed);

    const state = await saveAdminDraft(store, structuredClone(DEFAULT_ADMIN_CONTENT));

    expect(state.hasDraft).toBe(false);
    expect(state.draft).toEqual(state.published);
    expect(state.changedSections).toEqual([]);
  });

  it("publishes the saved draft atomically and preserves unmanaged Shopify keys", async () => {
    const store = memoryStore({ legacySetting: { enabled: true } });
    const content = structuredClone(DEFAULT_ADMIN_CONTENT);
    content.visibility.homeAthletes = false;
    await saveAdminDraft(store, content);

    const result = await publishAdminDraft(store, "2026-10-21T10:10:00.000Z");
    const rawPublished = JSON.parse((await store.read()).published?.value || "{}");

    expect(result.changedSections).toEqual(["Home"]);
    expect(result.state.hasDraft).toBe(false);
    expect(rawPublished).toMatchObject({ legacySetting: { enabled: true }, visibility: { homeAthletes: false } });
    expect(store.writes.at(-1)).toHaveLength(2);
    expect(store.writes.at(-1)?.map((write) => write.compareDigest)).toEqual([expect.any(String), expect.any(String)]);
  });

  it("rejects publication when the live Shopify settings changed since the draft was saved", async () => {
    const store = memoryStore();
    const content = structuredClone(DEFAULT_ADMIN_CONTENT);
    content.visibility.homeAthletes = false;
    await saveAdminDraft(store, content);
    store.setExternalSettings({ ...mergeAdminContent({}, DEFAULT_ADMIN_CONTENT), announcement: "External change" });
    const writeCount = store.writes.length;

    await expect(publishAdminDraft(store)).rejects.toMatchObject({ code: "conflict" });
    expect(store.writes).toHaveLength(writeCount);
  });

  it("detects external edits to settings managed outside this editor", async () => {
    const store = memoryStore();
    const content = structuredClone(DEFAULT_ADMIN_CONTENT);
    content.visibility.homeAthletes = false;
    await saveAdminDraft(store, content);
    store.setExternalSettings({ analyticsExtension: { enabled: true } });

    await expect(publishAdminDraft(store)).rejects.toMatchObject({ code: "conflict" });
  });

  it("reconciles a timeout after Shopify committed instead of blindly repeating the write", async () => {
    const store = memoryStore();
    const content = structuredClone(DEFAULT_ADMIN_CONTENT);
    content.visibility.homeAthletes = false;
    store.forceTimeoutAfterWrite = true;

    const state = await saveAdminDraft(store, content);

    expect(state.hasDraft).toBe(true);
    expect(store.writes).toHaveLength(1);
  });

  it("uses a conflict response when Shopify rejects a stale compareDigest", async () => {
    const store = memoryStore();
    const content = structuredClone(DEFAULT_ADMIN_CONTENT);
    content.announcement = "Saved draft";
    await saveAdminDraft(store, content);
    const staleStore = {
      ...store,
      async read() {
        const snapshot = await store.read();
        return { ...snapshot, draft: snapshot.draft ? { ...snapshot.draft, compareDigest: "stale" } : null };
      },
    };

    await expect(saveAdminDraft(staleStore, { ...content, announcement: "New copy" })).rejects.toMatchObject({ code: "conflict" });
  });
});
