"use client";

import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import { applyDensity, applyMode, Density, Mode } from "@cloudscape-design/global-styles";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { DENSITY_KEY, THEME_KEY } from "@/lib/themeBoot";

export type ThemeMode = "light" | "dark";
export type DensityMode = "comfortable" | "compact";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the preference just won't persist.
  }
}

interface PreferencesContextValue {
  theme: ThemeMode;
  density: DensityMode;
  setTheme: (theme: ThemeMode) => void;
  setDensity: (density: DensityMode) => void;
  navigationOpen: boolean;
  setNavigationOpen: (open: boolean) => void;
  shortcutsVisible: boolean;
  setShortcutsVisible: (visible: boolean) => void;
  splitPanelPreferences: AppLayoutProps.SplitPanelPreferences;
  setSplitPanelPreferences: (preferences: AppLayoutProps.SplitPanelPreferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [density, setDensityState] = useState<DensityMode>("comfortable");
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [splitPanelPreferences, setSplitPanelPreferences] = useState<AppLayoutProps.SplitPanelPreferences>({
    position: "side",
  });

  useEffect(() => {
    // Sync React state with the preference the boot script already applied.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (readStorage(THEME_KEY) === "dark") setThemeState("dark");
    if (readStorage(DENSITY_KEY) === "compact") setDensityState("compact");
    if (window.matchMedia("(max-width: 688px)").matches) setNavigationOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => applyMode(theme === "dark" ? Mode.Dark : Mode.Light), [theme]);
  useEffect(() => applyDensity(density === "compact" ? Density.Compact : Density.Comfortable), [density]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    writeStorage(THEME_KEY, next);
  }, []);

  const setDensity = useCallback((next: DensityMode) => {
    setDensityState(next);
    writeStorage(DENSITY_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      density,
      setTheme,
      setDensity,
      navigationOpen,
      setNavigationOpen,
      shortcutsVisible,
      setShortcutsVisible,
      splitPanelPreferences,
      setSplitPanelPreferences,
    }),
    [theme, density, setTheme, setDensity, navigationOpen, shortcutsVisible, splitPanelPreferences],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
