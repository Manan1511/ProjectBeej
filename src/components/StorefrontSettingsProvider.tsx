"use client";

import { createContext, useContext, useState } from "react";
import type { SiteSettings } from "@/lib/types";

type StorefrontSettingsState = { settings: SiteSettings; loaded: boolean };
const defaultState: StorefrontSettingsState = { settings: {}, loaded: true };
const StorefrontSettingsContext = createContext<StorefrontSettingsState>(defaultState);

export function StorefrontSettingsProvider({ children, initialSettings = {} }: { children: React.ReactNode; initialSettings?: SiteSettings }) {
  const [state] = useState<StorefrontSettingsState>(() => ({ settings: initialSettings, loaded: true }));

  return <StorefrontSettingsContext.Provider value={state}>{children}</StorefrontSettingsContext.Provider>;
}

export function useStorefrontSettings(fallback: SiteSettings = {}): StorefrontSettingsState {
  const state = useContext(StorefrontSettingsContext);
  return { ...state, settings: { ...fallback, ...state.settings } };
}
