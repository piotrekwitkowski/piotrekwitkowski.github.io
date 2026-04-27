import type { AppLayoutToolbarProps } from "@cloudscape-design/components";

const themeIcon = (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1V15Z" fill="currentColor" />
  </svg>
);

const DRAWER_ID = "theme-toggle";

export function themeDrawer(isDark: boolean): AppLayoutToolbarProps.Drawer {
  return {
    id: DRAWER_ID,
    content: <></>,
    trigger: { iconSvg: themeIcon },
    ariaLabels: {
      drawerName: isDark ? "Switch to light mode" : "Switch to dark mode",
    },
  };
}

export function isThemeDrawer(drawerId: string | null): boolean {
  return drawerId === DRAWER_ID;
}
