"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { captureInitialLanding, emitCommerceEvent, emitShopifyPageView, persistConsent, readStoredConsent, removeIdentifiersForWithdrawal, setTrackingRuntime, syncTrackingContext } from "@/lib/tracking-client";
import type { PublicTrackingConfig } from "@/lib/tracking-config";
import type { ConsentPreferences } from "@/lib/tracking-types";
import { useStorefrontSettings } from "@/components/StorefrontSettingsProvider";

const NO_CONSENT: ConsentPreferences = { analytics: false, marketing: false, preferences: false };
const LOADING_CONSENT = "beej:loading";

function subscribeToConsent(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener("beej:consent-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("beej:consent-change", callback);
  };
}

function getConsentSnapshot(): string {
  const stored = readStoredConsent();
  return stored ? JSON.stringify(stored) : "";
}

function getServerConsentSnapshot(): string { return LOADING_CONSENT; }

function removeTrackingParamsFromUrl(removeAttribution: boolean): void {
  const url = new URL(window.location.href);
  for (const key of ["gclid", "gbraid", "wbraid", "fbclid", ...(removeAttribution ? ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term"] : [])]) url.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function ConsentControls({
  consent,
  onSave,
  onClose,
}: {
  consent: ConsentPreferences;
  onSave: (value: ConsentPreferences) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(consent);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || [])].filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <div ref={dialogRef} className="tracking-settings" role="dialog" aria-modal="true" aria-labelledby="tracking-settings-title">
      <div className="tracking-settings-heading">
        <div>
          <p className="eyebrow">Your privacy</p>
          <h2 id="tracking-settings-title">Choose what feels right.</h2>
        </div>
        <button className="tracking-close" type="button" aria-label="Close privacy settings" onClick={onClose}>×</button>
      </div>
      <p className="tracking-description">Essential checkout and security storage always works. Optional measurement stays off until you choose it.</p>
      <label className="tracking-choice tracking-choice-locked">
        <span><strong>Essential</strong><small>Cart, checkout, security and consent preferences.</small></span>
        <input type="checkbox" checked disabled aria-label="Essential storage is always active" />
      </label>
      <label className="tracking-choice">
        <span><strong>Analytics</strong><small>Understand product discovery, shopping and site performance.</small></span>
        <input type="checkbox" checked={draft.analytics} onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))} />
      </label>
      <label className="tracking-choice">
        <span><strong>Advertising</strong><small>Measure campaigns across Meta and Google advertising.</small></span>
        <input type="checkbox" checked={draft.marketing} onChange={(event) => setDraft((current) => ({ ...current, marketing: event.target.checked }))} />
      </label>
      <label className="tracking-choice">
        <span><strong>Preferences</strong><small>Remember optional storefront preferences.</small></span>
        <input type="checkbox" checked={draft.preferences} onChange={(event) => setDraft((current) => ({ ...current, preferences: event.target.checked }))} />
      </label>
      <div className="tracking-settings-actions">
        <button className="button button-sage" type="button" onClick={() => onSave(draft)}>Save choices</button>
        <button className="tracking-text-button" type="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export function TrackingProvider({
  children,
  config,
  shopId,
  currency = "INR",
}: {
  children: React.ReactNode;
  config: PublicTrackingConfig;
  shopId: string;
  currency?: string;
}) {
  const pathname = usePathname();
  const { settings: storefrontSettings } = useStorefrontSettings();
  const activeShopId = storefrontSettings.shopId || shopId;
  const activeCurrency = storefrontSettings.currencyCode || currency;
  const consentSnapshot = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getServerConsentSnapshot);
  const consent = useMemo(() => {
    if (!consentSnapshot || consentSnapshot === LOADING_CONSENT) return NO_CONSENT;
    try {
      const value = JSON.parse(consentSnapshot) as { preferences?: unknown };
      const preferences = value.preferences;
      if (preferences && typeof preferences === "object" && "analytics" in preferences && "marketing" in preferences && "preferences" in preferences) return preferences as ConsentPreferences;
    } catch { /* Invalid consent becomes the default denied choice. */ }
    return NO_CONSENT;
  }, [consentSnapshot]);
  const ready = consentSnapshot !== LOADING_CONSENT;
  const hasChoice = Boolean(consentSnapshot && consentSnapshot !== LOADING_CONSENT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const lastPageView = useRef("");
  const lastShopifyPageView = useRef("");
  const initialSync = useRef(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const applyConsent = useCallback(async (next: ConsentPreferences) => {
    const previous = consent;
    const withdrew = (previous.analytics && !next.analytics) || (previous.marketing && !next.marketing) || (previous.preferences && !next.preferences);
    persistConsent(next);
    removeIdentifiersForWithdrawal(next);
    setSettingsOpen(false);
    setSyncMessage("");
    setTrackingRuntime({ config, consent: next, shopId: activeShopId, currency: activeCurrency });

    if (withdrew) removeTrackingParamsFromUrl(!next.analytics && !next.marketing);
    if (config.enabled && (next.analytics || next.marketing)) await new Promise((resolve) => window.setTimeout(resolve, 250));
    const synced = await syncTrackingContext(next, config);
    if (!synced && config.enabled) setSyncMessage("Your choice is saved on this device. Server sync is unavailable, so server purchase reporting stays off.");
    if (withdrew) window.location.reload();
  }, [activeCurrency, activeShopId, consent, config]);

  useEffect(() => {
    captureInitialLanding(config);
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("beej:open-consent-settings", openSettings);
    return () => window.removeEventListener("beej:open-consent-settings", openSettings);
  }, [config]);

  useEffect(() => {
    if (!ready) return;
    setTrackingRuntime({ config, consent, shopId: activeShopId, currency: activeCurrency });
    let emittedPageView = false;
    if (consent.analytics && pathname && lastPageView.current !== pathname) {
      lastPageView.current = pathname;
      emittedPageView = true;
      emitCommerceEvent({
        name: "page_view",
        page_location: `${window.location.origin}${pathname}`,
        page_title: document.title,
      });
    }
    if (consent.analytics && pathname && activeShopId && lastShopifyPageView.current !== pathname) {
      if (!emittedPageView) emitShopifyPageView();
      lastShopifyPageView.current = pathname;
    }
  }, [activeCurrency, activeShopId, consent, config, pathname, ready]);

  useEffect(() => {
    if (!ready || initialSync.current) return;
    initialSync.current = true;
    void syncTrackingContext(consent, config).then((synced) => {
      if (!synced && config.enabled) setSyncMessage("Your choice is saved on this device. Server sync is unavailable, so server purchase reporting stays off.");
    });
  }, [consent, config, ready]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "beej:consent:v1") return;
      const saved = readStoredConsent();
      const next = saved?.preferences || NO_CONSENT;
      const withdrew = (consent.analytics && !next.analytics) || (consent.marketing && !next.marketing);
      setTrackingRuntime({ config, consent: next, shopId: activeShopId, currency: activeCurrency });
      void syncTrackingContext(next, config);
      if (withdrew) {
        removeIdentifiersForWithdrawal(next);
        removeTrackingParamsFromUrl(!next.analytics && !next.marketing);
        window.location.reload();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activeCurrency, activeShopId, config, consent]);

  return (
    <>
      {!hasChoice && !settingsOpen ? (
        <section className="tracking-banner" aria-label="Privacy choices">
          <div className="tracking-banner-copy">
            <p className="eyebrow">A little choice, a lot of clarity</p>
            <h2>Cookies are optional. Good snacks aren’t.</h2>
            <p>Choose whether we can measure visits and campaign performance. You can change your mind any time.</p>
          </div>
          <div className="tracking-banner-actions">
            <button className="button button-sage" type="button" onClick={() => void applyConsent({ analytics: true, marketing: true, preferences: true })}>Accept all</button>
            <button className="button tracking-reject" type="button" onClick={() => void applyConsent(NO_CONSENT)}>Reject all</button>
            <button className="tracking-text-button" type="button" onClick={() => setSettingsOpen(true)}>Settings</button>
          </div>
          {syncMessage ? <p className="tracking-status" role="status">{syncMessage}</p> : null}
        </section>
      ) : null}
      {children}
      {settingsOpen ? (
        <>
          <div className="tracking-settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSettings(); }}>
            <ConsentControls key={`${consent.analytics}-${consent.marketing}-${consent.preferences}`} consent={consent} onSave={(next) => void applyConsent(next)} onClose={closeSettings} />
          </div>
        </>
      ) : null}
      {syncMessage && hasChoice && !settingsOpen ? <p className="tracking-status tracking-status-persistent" role="status">{syncMessage}</p> : null}
    </>
  );
}
