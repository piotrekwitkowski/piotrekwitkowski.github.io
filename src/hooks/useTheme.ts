import { useState, useEffect, useCallback } from "react";
import { Mode, applyMode } from "@cloudscape-design/global-styles";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme-mode";

function getSystemPreference(): Mode {
  if (typeof window === "undefined") return Mode.Light;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? Mode.Dark
    : Mode.Light;
}

function resolveMode(themeMode: ThemeMode): Mode {
  if (themeMode === "system") return getSystemPreference();
  return themeMode === "dark" ? Mode.Dark : Mode.Light;
}

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? "system";
  });

  const effectiveTheme = resolveMode(themeMode);
  const isDark = effectiveTheme === Mode.Dark;

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  useEffect(() => {
    applyMode(effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyMode(resolveMode("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  return { themeMode, setThemeMode, effectiveTheme, isDark };
}
