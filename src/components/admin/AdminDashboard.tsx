"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_ADMIN_CONTENT } from "@/lib/admin-content-defaults";
import type { AdminContent } from "@/lib/admin-content-types";
import type { SiteVisibility } from "@/lib/types";

type AdminContentState = {
  published: AdminContent;
  draft: AdminContent;
  hasDraft: boolean;
  conflict: boolean;
  changedSections: string[];
  updatedAt: string | null;
};
type ProductChoice = { handle: string; title: string; productType: string; price: { amount: string; currencyCode: string }; image: string | null };
type ApiResult = AdminContentState & { error?: string; errors?: Record<string, string> };
type TabKey = "home" | "shop" | "about" | "shared";
type FieldConfig = { path: string; label: string; max: number; multiline?: boolean; type?: "text" | "email" | "url"; optional?: boolean };
type EditorGroup = { title: string; visibility?: keyof SiteVisibility; fields?: FieldConfig[] };

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" }, { key: "shop", label: "Shop" }, { key: "about", label: "Our Story" }, { key: "shared", label: "Shared" },
];

const groups: Record<TabKey, EditorGroup[]> = {
  home: [
    { title: "Scrolling ribbon", visibility: "homeRibbon" },
    { title: "Hero", fields: [
      { path: "homeCopy.heroEyebrow", label: "Eyebrow", max: 90 },
      { path: "homeCopy.heroTitleLineOne", label: "Heading, first line", max: 80 },
      { path: "homeCopy.heroTitleLineTwo", label: "Heading, second line", max: 80 },
      { path: "homeCopy.heroDescription", label: "Description", max: 320, multiline: true },
      { path: "homeCopy.heroShopLabel", label: "Shop button", max: 48 },
      { path: "homeCopy.heroStoryLabel", label: "Story button", max: 48 },
    ] },
    { title: "Featured shelf", visibility: "homeFeatured", fields: [
      { path: "homeCopy.featuredTitle", label: "Heading", max: 80 },
      { path: "homeCopy.featuredLinkLabel", label: "Shop link", max: 48 },
    ] },
    { title: "Snacking is a sport", visibility: "homeAthletes", fields: [
      { path: "homeCopy.teamEyebrow", label: "Eyebrow", max: 80 },
      { path: "homeCopy.teamTitle", label: "Heading", max: 100 },
      { path: "homeCopy.teamDescription", label: "Description", max: 320, multiline: true },
    ] },
    { title: "Our story", visibility: "homeStory", fields: [
      { path: "homeCopy.storyTitleLineOne", label: "Heading, first line", max: 120 },
      { path: "homeCopy.storyTitleHighlight", label: "Heading, highlighted line", max: 100 },
      { path: "homeCopy.storyDescription", label: "Description", max: 500, multiline: true },
      { path: "homeCopy.storyCta", label: "Button", max: 48 },
    ] },
    { title: "Values", visibility: "homeValues", fields: [
      { path: "homeCopy.valuesTitle", label: "Heading", max: 100 },
      { path: "homeCopy.valueOneTitle", label: "First value", max: 80 },
      { path: "homeCopy.valueOneDescription", label: "First description", max: 240, multiline: true },
      { path: "homeCopy.valueTwoTitle", label: "Second value", max: 80 },
      { path: "homeCopy.valueTwoDescription", label: "Second description", max: 240, multiline: true },
      { path: "homeCopy.valueThreeTitle", label: "Third value", max: 80 },
      { path: "homeCopy.valueThreeDescription", label: "Third description", max: 240, multiline: true },
    ] },
    { title: "Community gallery", visibility: "homeCommunity", fields: [
      { path: "homeCopy.communityEyebrow", label: "Eyebrow", max: 90 },
      { path: "homeCopy.communityTitle", label: "Heading", max: 80 },
      { path: "homeCopy.communityLinkLabel", label: "Instagram link label", max: 48 },
    ] },
  ],
  shop: [
    { title: "Shop hero", fields: [
      { path: "shopCopy.heroEyebrow", label: "Eyebrow", max: 90 },
      { path: "shopCopy.heroTitle", label: "Heading", max: 80 },
      { path: "shopCopy.heroDescriptionLineOne", label: "Description, first line", max: 180 },
      { path: "shopCopy.heroDescriptionLineTwo", label: "Description, second line", max: 180 },
    ] },
    { title: "Snack spotted", visibility: "shopSnackSpotted", fields: [
      { path: "shopCopy.spottedTitle", label: "Heading", max: 80 },
      { path: "shopCopy.spottedDescription", label: "Description", max: 180, multiline: true },
      { path: "shopCopy.seedBannerLineOne", label: "Seed banner, first line", max: 60 },
      { path: "shopCopy.seedBannerLineTwo", label: "Seed banner, second line", max: 60 },
    ] },
    { title: "Shopping benefits", visibility: "shopBenefits", fields: [
      { path: "shopCopy.benefitOneTitle", label: "First benefit", max: 80 },
      { path: "shopCopy.benefitOneDescription", label: "First description", max: 180 },
      { path: "shopCopy.benefitTwoTitle", label: "Second benefit", max: 80 },
      { path: "shopCopy.benefitTwoDescription", label: "Second description", max: 180 },
      { path: "shopCopy.benefitThreeTitle", label: "Third benefit", max: 80 },
      { path: "shopCopy.benefitThreeDescription", label: "Third description", max: 180 },
    ] },
  ],
  about: [
    { title: "Our Story hero", fields: [
      { path: "aboutCopy.heroEyebrow", label: "Eyebrow", max: 90 },
      { path: "aboutCopy.heroTitleLineOne", label: "Heading, first line", max: 120 },
      { path: "aboutCopy.heroTitleLineTwo", label: "Heading, second line", max: 120 },
    ] },
    { title: "Introduction and gallery", visibility: "aboutIntroGallery", fields: [
      { path: "aboutCopy.introTitleLineOne", label: "Introduction heading, first line", max: 120 },
      { path: "aboutCopy.introTitleLineTwo", label: "Introduction heading, second line", max: 120 },
      { path: "aboutCopy.introTitleEmphasis", label: "Introduction heading, emphasis", max: 120 },
      { path: "aboutCopy.introParagraphOne", label: "First paragraph", max: 500, multiline: true },
      { path: "aboutCopy.introParagraphTwo", label: "Second paragraph", max: 500, multiline: true },
      { path: "aboutCopy.introParagraphThree", label: "Third paragraph", max: 300, multiline: true },
    ] },
    { title: "Seed banner", visibility: "aboutSeedBanner", fields: [
      { path: "aboutCopy.seedEyebrow", label: "Eyebrow", max: 90 },
      { path: "aboutCopy.seedTitleLineOne", label: "Heading, first line", max: 80 },
      { path: "aboutCopy.seedTitleLineTwo", label: "Heading, second line", max: 80 },
    ] },
    { title: "What we believe", visibility: "aboutBeliefs", fields: [
      { path: "aboutCopy.beliefsTitle", label: "Heading", max: 100 },
      { path: "aboutCopy.beliefOneTitle", label: "First belief", max: 80 },
      { path: "aboutCopy.beliefOneDescription", label: "First description", max: 240, multiline: true },
      { path: "aboutCopy.beliefTwoTitle", label: "Second belief", max: 80 },
      { path: "aboutCopy.beliefTwoDescription", label: "Second description", max: 240, multiline: true },
      { path: "aboutCopy.beliefThreeTitle", label: "Third belief", max: 80 },
      { path: "aboutCopy.beliefThreeDescription", label: "Third description", max: 240, multiline: true },
    ] },
    { title: "Closing call to action", visibility: "aboutClosing", fields: [
      { path: "aboutCopy.closingTitle", label: "Heading", max: 100 },
      { path: "aboutCopy.closingButtonLabel", label: "Button", max: 48 },
    ] },
  ],
  shared: [
    { title: "Announcement", visibility: "announcement", fields: [
      { path: "announcement", label: "Announcement text", max: 160 },
    ] },
    { title: "Newsletter", visibility: "newsletter", fields: [
      { path: "homeCopy.newsletterTitleLead", label: "Heading, first part", max: 80 },
      { path: "homeCopy.newsletterTitleEmphasis", label: "Heading, emphasis", max: 80 },
      { path: "homeCopy.newsletterDescription", label: "Description", max: 320, multiline: true },
    ] },
    { title: "Footer and contact", fields: [
      { path: "footerCopy.tagline", label: "Footer tagline", max: 180, multiline: true },
      { path: "contactEmail", label: "Contact email", max: 254, type: "email" },
      { path: "footerCopy.location", label: "Location", max: 120 },
      { path: "instagramUrl", label: "Instagram profile URL", max: 250, type: "url", optional: true },
      { path: "whatsappUrl", label: "WhatsApp link", max: 250, type: "url", optional: true },
    ] },
  ],
};

function readPath(content: AdminContent, path: string): string {
  const [group, key] = path.split(".");
  const value = group ? (content as unknown as Record<string, unknown>)[group] : undefined;
  const nested = value && typeof value === "object" ? (value as Record<string, unknown>)[key || ""] : undefined;
  const result = key ? nested : value;
  return typeof result === "string" ? result : "";
}

function updatePath(content: AdminContent, path: string, value: string): AdminContent {
  const [group, key] = path.split(".");
  if (!group) return content;
  const current = (content as unknown as Record<string, unknown>)[group];
  if (!key) return { ...content, [group]: value } as AdminContent;
  if (!current || typeof current !== "object") return content;
  return { ...content, [group]: { ...(current as Record<string, unknown>), [key]: value } } as AdminContent;
}

function cleanId(value: string) { return value.replace(/[^a-zA-Z0-9_-]/g, "-"); }

function TextField({ field, value, error, onChange, onReset }: {
  field: FieldConfig; value: string; error?: string; onChange: (value: string) => void; onReset: () => void;
}) {
  const id = `admin-${cleanId(field.path)}`;
  const errorId = `${id}-error`;
  const inputProps = {
    id,
    value,
    maxLength: field.max,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  return <div className="admin-field">
    <div className="admin-field-heading"><label htmlFor={id}>{field.label}</label><button type="button" className="admin-reset" onClick={onReset}>Reset</button></div>
    {field.multiline ? <textarea {...inputProps} rows={3} /> : <input {...inputProps} type={field.type || "text"} required={!field.optional} />}
    <div className="admin-field-meta">{error ? <span className="admin-form-error" role="alert" id={errorId}>{error}</span> : <span /> }<span>{value.length}/{field.max}</span></div>
  </div>;
}

function VisibilityToggle({ value, onChange, onReset }: { value: boolean; onChange: (next: boolean) => void; onReset: () => void }) {
  return <div className="admin-toggle-wrap">
    <button className={`admin-switch ${value ? "is-on" : ""}`} role="switch" aria-checked={value} type="button" onClick={() => onChange(!value)}>
      <span className="admin-switch-knob" />
      <span>{value ? "Shown" : "Hidden"}</span>
    </button>
    <button type="button" className="admin-reset" onClick={onReset}>Reset</button>
  </div>;
}

function sectionQuery(key: TabKey) { return key === "about" ? "about" : key; }

export function AdminDashboard({ shopifyAdminBase }: { shopifyAdminBase: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [state, setState] = useState<AdminContentState | null>(null);
  const [draft, setDraft] = useState<AdminContent>(DEFAULT_ADMIN_CONTENT);
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "discard" | "publish" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [productError, setProductError] = useState("");

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/content", { cache: "no-store", credentials: "same-origin" });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error || "Shopify settings could not be loaded.");
      setState(result);
      setDraft(result.draft);
      setError("");
      setFieldErrors({});
      const productResponse = await fetch("/api/admin/products", { cache: "no-store", credentials: "same-origin" });
      const productResult = await productResponse.json() as { products?: ProductChoice[]; error?: string };
      if (productResponse.ok && Array.isArray(productResult.products)) {
        setProducts(productResult.products);
        setProductError("");
      } else {
        setProductError(productResult.error || "Product options could not be loaded.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Shopify settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const dirty = Boolean(state && JSON.stringify(draft) !== JSON.stringify(state.draft));
  const missingHandles = draft.featuredHandles.filter((handle) => !products.some((product) => product.handle === handle));

  function changeField(path: string, value: string) {
    setDraft((current) => updatePath(current, path, value));
    setFieldErrors((current) => { const next = { ...current }; delete next[path]; return next; });
    setMessage("");
  }

  function changeVisibility(key: keyof SiteVisibility, value: boolean) {
    setDraft((current) => ({ ...current, visibility: { ...current.visibility, [key]: value } }));
    setFieldErrors((current) => { const next = { ...current }; delete next[`visibility.${key}`]; return next; });
    setMessage("");
  }

  async function saveDraft() {
    if (!dirty || busy) return;
    setBusy("save"); setError(""); setMessage(""); setFieldErrors({});
    try {
      const response = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(draft) });
      const result = await response.json() as ApiResult;
      if (!response.ok) {
        if (result.errors) setFieldErrors(result.errors);
        throw new Error(result.error || "Draft could not be saved.");
      }
      setState(result); setDraft(result.draft); setMessage("Draft saved privately. The live storefront is unchanged.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Draft could not be saved.");
    } finally { setBusy(null); }
  }

  async function discardDraft() {
    if (!state?.hasDraft || busy) return;
    setBusy("discard"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/content/discard", { method: "POST", credentials: "same-origin" });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error || "Draft could not be discarded.");
      setState(result); setDraft(result.draft); setFieldErrors({}); setMessage("Saved draft discarded. The published content remains live.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Draft could not be discarded.");
    } finally { setBusy(null); }
  }

  async function publishDraft() {
    if (!state?.hasDraft || state.conflict || dirty || busy) return;
    const changed = state.changedSections.length ? state.changedSections.join(", ") : "the selected content";
    if (!window.confirm(`Publish the saved changes to ${changed}? The public site will update immediately.`)) return;
    setBusy("publish"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/content/publish", { method: "POST", credentials: "same-origin" });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error || "Draft could not be published.");
      setState(result); setDraft(result.draft); setMessage("Published. The storefront is now using this content.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Draft could not be published.");
    } finally { setBusy(null); }
  }

  function toggleProduct(handle: string) {
    const selected = draft.featuredHandles;
    if (selected.includes(handle)) {
      setDraft((current) => ({ ...current, featuredHandles: current.featuredHandles.filter((item) => item !== handle) }));
      setProductError("");
    } else if (selected.length >= 4) setProductError("Choose no more than four featured products.");
    else {
      setDraft((current) => ({ ...current, featuredHandles: [...current.featuredHandles, handle] }));
      setProductError("");
    }
    setMessage("");
  }

  function moveProduct(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= draft.featuredHandles.length) return;
    setDraft((current) => {
      const featuredHandles = [...current.featuredHandles];
      [featuredHandles[index], featuredHandles[destination]] = [featuredHandles[destination]!, featuredHandles[index]!];
      return { ...current, featuredHandles };
    });
    setMessage("");
  }

  function resetFeatured() {
    setDraft((current) => ({ ...current, featuredHandles: [...DEFAULT_ADMIN_CONTENT.featuredHandles] }));
    setFieldErrors((current) => { const next = { ...current }; delete next.featuredHandles; return next; });
    setMessage("");
  }

  function resetVisibility(key: keyof SiteVisibility) { changeVisibility(key, DEFAULT_ADMIN_CONTENT.visibility[key]); }

  if (loading && !state) return <main className="admin-main"><p className="admin-loading" role="status">Loading Shopify content…</p></main>;

  return <main className="admin-main">
    <header className="admin-page-heading">
      <div><p className="admin-kicker">Storefront controls</p><h1>Content studio</h1><p>Save privately, preview each page, then publish when the copy and sections look right.</p></div>
      <div className="admin-published-status">
        <span className={`admin-status-dot ${state?.hasDraft ? "is-draft" : ""}`} />
        <span>{state?.conflict ? "Needs review" : state?.hasDraft ? "Draft saved" : "Published version"}</span>
      </div>
    </header>

    <nav className="admin-quick-links" aria-label="Shopify Admin shortcuts">
      <span>Catalog and orders stay in Shopify</span>
      <a href={`${shopifyAdminBase}/products`} target="_blank" rel="noreferrer">Products ↗</a>
      <a href={`${shopifyAdminBase}/orders`} target="_blank" rel="noreferrer">Orders ↗</a>
      <a href={`${shopifyAdminBase}/settings`} target="_blank" rel="noreferrer">Store settings ↗</a>
    </nav>

    {state?.conflict ? <div className="admin-conflict-banner" role="alert"><p>The published settings changed after this draft began. Reload to review the newest version before saving or publishing.</p><button type="button" onClick={() => { setLoading(true); void reload(); }}>Reload latest</button></div> : null}
    {error ? <div className="admin-error-banner" role="alert"><div><p>{error}</p>{error.includes("Shopify") ? <p>Check the project’s admin setup guide, Shopify app access, and server environment settings, then retry.</p> : null}</div></div> : null}
    {message ? <p className="admin-success-banner" role="status">{message}</p> : null}

    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-heading"><span>Pages</span><span>4</span></div>
        {tabs.map((tab) => <button type="button" key={tab.key} className={`admin-sidebar-tab ${activeTab === tab.key ? "is-active" : ""}`} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => { setActiveTab(tab.key); setFieldErrors({}); }}>
          <span>{tab.label}</span>
          <span className="admin-sidebar-dot" aria-hidden="true" />
        </button>)}
        <div className="admin-sidebar-preview">
          <span className="admin-sidebar-heading">Preview saved content</span>
          {tabs.slice(0, 3).map((tab) => <Link href={`/admin/preview?page=${sectionQuery(tab.key)}`} key={tab.key}>Preview {tab.label.toLowerCase()} ↗</Link>)}
          <p>Save your changes before previewing them.</p>
        </div>
      </aside>

      <section className="admin-editor" aria-labelledby="admin-tab-title">
        <div className="admin-editor-heading"><div><h2 id="admin-tab-title">{tabs.find((tab) => tab.key === activeTab)?.label}</h2><p>{activeTab === "shared" ? "Content shared across the storefront." : `Edit the ${tabs.find((tab) => tab.key === activeTab)?.label} page.`}</p></div><span className="admin-change-count">{dirty ? "Unsaved edits" : state?.hasDraft ? "Draft saved" : "No draft changes"}</span></div>
        <div className="admin-tab-list" role="tablist" aria-label="Content area">
          {tabs.map((tab) => <button type="button" key={tab.key} role="tab" aria-selected={activeTab === tab.key} aria-controls="admin-tab-panel" id={`admin-tab-${tab.key}`} onClick={() => { setActiveTab(tab.key); setFieldErrors({}); }}>{tab.label}</button>)}
        </div>
        <div id="admin-tab-panel" role="tabpanel" aria-labelledby={`admin-tab-${activeTab}`}>
          {groups[activeTab].map((group) => <section className="admin-edit-group" key={group.title}>
            <div className="admin-edit-group-heading"><h3>{group.title}</h3>{group.visibility ? <VisibilityToggle value={draft.visibility[group.visibility]} onChange={(value) => changeVisibility(group.visibility!, value)} onReset={() => resetVisibility(group.visibility!)} /> : null}</div>
            {group.fields?.length ? <div className="admin-fields-grid">{group.fields.map((field) => <TextField key={field.path} field={field} value={readPath(draft, field.path)} error={fieldErrors[field.path]} onChange={(value) => changeField(field.path, value)} onReset={() => changeField(field.path, readPath(DEFAULT_ADMIN_CONTENT, field.path))} />)}</div> : null}
            {activeTab === "home" && group.title === "Featured shelf" ? <div className="admin-featured-picker">
              <div className="admin-featured-heading"><div><h4>Choose products</h4><p>Select and order up to four products for this shelf. Hero rotation uses the full catalog.</p></div><button type="button" className="admin-reset" onClick={resetFeatured}>Reset</button></div>
              {fieldErrors.featuredHandles ? <p className="admin-form-error" role="alert">{fieldErrors.featuredHandles}</p> : null}
              {productError ? <p className="admin-form-error" role="status">{productError}</p> : null}
              <div className="admin-featured-options">{products.map((product) => <label className={`admin-product-choice ${draft.featuredHandles.includes(product.handle) ? "is-selected" : ""}`} key={product.handle}>
                <input type="checkbox" checked={draft.featuredHandles.includes(product.handle)} onChange={() => toggleProduct(product.handle)} />
                <span><strong>{product.title}</strong><small>{product.productType} · {product.handle}</small></span>
              </label>)}</div>
              {missingHandles.length ? <p className="admin-missing-products">Saved selections no longer in the catalog: {missingHandles.join(", ")}. Remove them below.</p> : null}
              {draft.featuredHandles.length ? <ol className="admin-featured-order" aria-label="Featured product order">{draft.featuredHandles.map((handle, index) => {
                const product = products.find((item) => item.handle === handle);
                return <li key={handle}><span>{product?.title || `Missing product: ${handle}`}</span><div>
                  <button type="button" aria-label={`Move ${product?.title || handle} up`} disabled={index === 0} onClick={() => moveProduct(index, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${product?.title || handle} down`} disabled={index === draft.featuredHandles.length - 1} onClick={() => moveProduct(index, 1)}>↓</button>
                  <button type="button" aria-label={`Remove ${product?.title || handle}`} onClick={() => toggleProduct(handle)}>Remove</button>
                </div></li>;
              })}</ol> : <p className="admin-muted-note">No products selected. The featured shelf will stay empty until you add one.</p>}
              <span className="admin-form-count">{draft.featuredHandles.length}/4 selected</span>
            </div> : null}
          </section>)}
        </div>
      </section>
    </div>

    <footer className="admin-actionbar">
      <div className="admin-actionbar-state"><span className={`admin-status-dot ${dirty ? "is-unsaved" : state?.hasDraft ? "is-draft" : ""}`} /><span>{dirty ? "Unsaved changes" : state?.hasDraft ? `Saved ${state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "draft"}` : "All changes are published"}</span></div>
      <div className="admin-action-buttons">
        {state?.hasDraft ? <button className="admin-secondary-button" type="button" onClick={() => void discardDraft()} disabled={busy !== null || dirty || state.conflict}>{busy === "discard" ? "Discarding…" : "Discard draft"}</button> : null}
        <button className="admin-secondary-button" type="button" onClick={() => void saveDraft()} disabled={!dirty || busy !== null || state?.conflict}>{busy === "save" ? "Saving…" : "Save draft"}</button>
        <button className="admin-primary-button" type="button" onClick={() => void publishDraft()} disabled={!state?.hasDraft || dirty || busy !== null || state.conflict}>{busy === "publish" ? "Publishing…" : "Publish"}</button>
      </div>
    </footer>
    {state?.hasDraft ? <p className="admin-changed-sections">Ready to publish: {state.changedSections.join(", ") || "No section changes"}.</p> : null}
  </main>;
}
