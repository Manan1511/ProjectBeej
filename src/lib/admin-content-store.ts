import {
  changedAdminSections,
  contentFromSettings,
  mergeAdminContent,
  parseAdminContent,
  stableContentHash,
  type AdminContent,
} from "@/lib/admin-content";

export type AdminMetafieldSnapshot = { value: string; compareDigest: string };
export type AdminMetafieldWrite = {
  ownerId: string;
  namespace?: string;
  key: string;
  type: "json";
  value: string;
  compareDigest: string | null;
};

export type AdminContentStoreSnapshot = {
  shopId: string;
  appInstallationId: string;
  published: AdminMetafieldSnapshot | null;
  draft: AdminMetafieldSnapshot | null;
};

export type AdminContentStore = {
  read(): Promise<AdminContentStoreSnapshot>;
  setMetafields(writes: AdminMetafieldWrite[]): Promise<void>;
};

export class AdminContentStoreError extends Error {
  constructor(readonly code: "conflict" | "not-found" | "invalid" | "unavailable", message: string) {
    super(message);
    this.name = "AdminContentStoreError";
  }
}

type DraftRecord = {
  schemaVersion: 1;
  baseLiveHash: string;
  content: AdminContent;
  updatedAt: string;
};

export type AdminContentState = {
  published: AdminContent;
  draft: AdminContent;
  hasDraft: boolean;
  conflict: boolean;
  baseLiveHash: string;
  changedSections: string[];
  updatedAt: string | null;
};

export type AdminPublishResult = { state: AdminContentState; changedSections: string[] };

function parseSettings(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    return parsed as Record<string, unknown>;
  } catch {
    throw new AdminContentStoreError("unavailable", "Published Shopify settings are invalid. Fix the metafield in Shopify before editing.");
  }
}

function parseDraft(value: string | undefined): DraftRecord | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    const record = parsed as Record<string, unknown>;
    if (record.schemaVersion !== 1 || typeof record.baseLiveHash !== "string" || !/^[a-f\d]{64}$/.test(record.baseLiveHash) || typeof record.updatedAt !== "string") throw new Error("invalid");
    const content = parseAdminContent(record.content);
    if (!content.success) throw new Error("invalid");
    return { schemaVersion: 1, baseLiveHash: record.baseLiveHash, updatedAt: record.updatedAt, content: content.data };
  } catch {
    throw new AdminContentStoreError("unavailable", "The saved Shopify draft is invalid. Keep its value safe and contact support before resetting it.");
  }
}

export async function getAdminContentState(store: AdminContentStore): Promise<AdminContentState> {
  let snapshot: AdminContentStoreSnapshot;
  try {
    snapshot = await store.read();
  } catch (error) {
    if (error instanceof AdminContentStoreError) throw error;
    throw new AdminContentStoreError("unavailable", "Shopify content could not be loaded. Try again.");
  }
  if (!/^gid:\/\/shopify\/Shop\/\d+$/.test(snapshot.shopId) || !/^gid:\/\/shopify\/AppInstallation\/\d+$/.test(snapshot.appInstallationId)) {
    throw new AdminContentStoreError("unavailable", "Shopify did not return the required content owners.");
  }
  const publishedSettings = parseSettings(snapshot.published?.value);
  const published = contentFromSettings(publishedSettings);
  const publishedHash = stableContentHash(published);
  const liveSettingsHash = stableContentHash(publishedSettings);
  const savedDraft = parseDraft(snapshot.draft?.value);
  const draft = savedDraft?.content ?? published;
  const baseLiveHash = savedDraft?.baseLiveHash ?? liveSettingsHash;
  const hasDraft = stableContentHash(draft) !== publishedHash;
  const conflict = Boolean(savedDraft && savedDraft.baseLiveHash !== liveSettingsHash);
  return {
    published,
    draft,
    hasDraft,
    conflict,
    baseLiveHash,
    changedSections: hasDraft ? changedAdminSections(published, draft) : [],
    updatedAt: savedDraft?.updatedAt ?? null,
  };
}

async function writeAndConfirm(
  store: AdminContentStore,
  writes: AdminMetafieldWrite[],
  matches: (state: AdminContentState) => boolean,
): Promise<AdminContentState> {
  let writeError: unknown;
  try {
    await store.setMetafields(writes);
  } catch (error) {
    writeError = error;
  }

  let state: AdminContentState;
  try {
    state = await getAdminContentState(store);
  } catch {
    if (writeError instanceof AdminContentStoreError) throw writeError;
    throw new AdminContentStoreError("unavailable", "Shopify could not confirm the update. Reload the dashboard before trying again.");
  }
  if (matches(state)) return state;
  if (writeError instanceof AdminContentStoreError && writeError.code === "conflict") throw writeError;
  if (writeError) throw new AdminContentStoreError("unavailable", "Shopify could not confirm the update. Reload the dashboard before trying again.");
  throw new AdminContentStoreError("conflict", "Shopify content changed in another session. Reload to review the latest version.");
}

function validatedContent(value: AdminContent): AdminContent {
  const result = parseAdminContent(value);
  if (!result.success) throw new AdminContentStoreError("invalid", "Fix the content fields with validation errors before saving.");
  return result.data;
}

export async function saveAdminDraft(store: AdminContentStore, value: AdminContent, now = new Date().toISOString()): Promise<AdminContentState> {
  const content = validatedContent(value);
  const snapshot = await store.read();
  const state = await getAdminContentState(store);
  if (state.conflict) throw new AdminContentStoreError("conflict", "Published Shopify content changed after this draft began. Reload before saving.");
  const savedDraft = parseDraft(snapshot.draft?.value);
  const next: DraftRecord = {
    schemaVersion: 1,
    baseLiveHash: savedDraft?.baseLiveHash ?? state.baseLiveHash,
    content,
    updatedAt: now,
  };
  return writeAndConfirm(store, [{
    ownerId: snapshot.appInstallationId,
    key: "storefront_content_draft",
    type: "json",
    value: JSON.stringify(next),
    compareDigest: snapshot.draft?.compareDigest ?? null,
  }], (current) => !current.conflict
    && stableContentHash(current.draft) === stableContentHash(content)
    && current.baseLiveHash === next.baseLiveHash);
}

export async function discardAdminDraft(store: AdminContentStore, now = new Date().toISOString()): Promise<AdminContentState> {
  const snapshot = await store.read();
  const state = await getAdminContentState(store);
  if (state.conflict) throw new AdminContentStoreError("conflict", "Published Shopify content changed after this draft began. Reload before discarding it.");
  if (!snapshot.draft || !state.hasDraft) return state;
  const record: DraftRecord = {
    schemaVersion: 1,
    baseLiveHash: state.baseLiveHash,
    content: state.published,
    updatedAt: now,
  };
  return writeAndConfirm(store, [{
    ownerId: snapshot.appInstallationId,
    key: "storefront_content_draft",
    type: "json",
    value: JSON.stringify(record),
    compareDigest: snapshot.draft.compareDigest,
  }], (current) => !current.hasDraft && !current.conflict);
}

export async function publishAdminDraft(store: AdminContentStore, now = new Date().toISOString()): Promise<AdminPublishResult> {
  const snapshot = await store.read();
  const state = await getAdminContentState(store);
  if (state.conflict) throw new AdminContentStoreError("conflict", "Published Shopify content changed after this draft began. Reload before publishing it.");
  if (!snapshot.draft || !state.hasDraft) throw new AdminContentStoreError("not-found", "There is no saved draft to publish.");

  const changedSections = changedAdminSections(state.published, state.draft);
  const publishedSettings = parseSettings(snapshot.published?.value);
  const nextSettings = mergeAdminContent(publishedSettings, state.draft);
  const nextHash = stableContentHash(nextSettings);
  const nextDraft: DraftRecord = {
    schemaVersion: 1,
    baseLiveHash: nextHash,
    content: state.draft,
    updatedAt: now,
  };

  const nextState = await writeAndConfirm(store, [
    {
      ownerId: snapshot.shopId,
      namespace: "beej",
      key: "storefront_settings",
      type: "json",
      value: JSON.stringify(nextSettings),
      compareDigest: snapshot.published?.compareDigest ?? null,
    },
    {
      ownerId: snapshot.appInstallationId,
      key: "storefront_content_draft",
      type: "json",
      value: JSON.stringify(nextDraft),
      compareDigest: snapshot.draft.compareDigest,
    },
  ], (current) => !current.hasDraft && !current.conflict && current.baseLiveHash === nextHash);

  return { state: nextState, changedSections };
}
