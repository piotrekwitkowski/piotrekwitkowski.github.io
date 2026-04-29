import { useState } from "react";
import {
  AppLayoutToolbar,
  type AppLayoutToolbarProps,
} from "@cloudscape-design/components";
import { ThemeProvider, useThemeContext } from "../context/ThemeContext";
import { themeDrawer, isThemeDrawer } from "./ThemeToggle";

function AppLayoutInner(props: AppLayoutToolbarProps) {
  const { isDark, setThemeMode } = useThemeContext();
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);

  const drawers: AppLayoutToolbarProps.Drawer[] = [themeDrawer(isDark)];
  if (props.tools && !props.toolsHide) {
    drawers.push({
      id: "tools",
      content: props.tools,
      defaultSize: props.toolsWidth,
      trigger: { iconName: "status-info" },
      ariaLabels: { drawerName: "Tools", triggerButton: "Tools" },
    });
  }
  if (props.drawers) {
    drawers.push(...props.drawers);
  }

  return (
    <AppLayoutToolbar
      {...props}
      ariaLabels={{ navigationToggle: "Toggle navigation", navigationClose: "Close navigation" }}
      toolsHide
      drawers={drawers}
      activeDrawerId={activeDrawerId}
      onDrawerChange={(event) => {
        if (isThemeDrawer(event.detail.activeDrawerId)) {
          setThemeMode(isDark ? "light" : "dark");
        } else {
          setActiveDrawerId(event.detail.activeDrawerId);
          props.onDrawerChange?.(event);
        }
      }}
    />
  );
}

export function AppLayout(props: AppLayoutToolbarProps) {
  return (
    <ThemeProvider>
      <AppLayoutInner {...props} />
    </ThemeProvider>
  );
}
