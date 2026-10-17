"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/types";

type StorefrontSettingsState = { settings: SiteSettings; loaded: boolean };
const defaultState: StorefrontSettingsState = { settings: {}, loaded: false };
const StorefrontSettingsContext = createContext<StorefrontSettingsState>(defaultState);

export function StorefrontSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(defaultState);

  useEffect(() => {
    let active = true;
    void fetch("/api/storefront/settings").then(async (response) => {
      if (!response.ok) return {};
      return await response.json() as SiteSettings;
    }).catch(() => ({})).then((settings: SiteSettings) => {
      if (active) setState({ settings, loaded: true });
    });
    return () => { active = false; };
  }, []);

  return <StorefrontSettingsContext.Provider value={state}>{children}</StorefrontSettingsContext.Provider>;
}

export function useStorefrontSettings(fallback: SiteSettings = {}): StorefrontSettingsState {
  const state = useContext(StorefrontSettingsContext);
  return { ...state, settings: { ...fallback, ...state.settings } };
}
