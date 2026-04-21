import React from "react";
import { SideNavigation } from "@cloudscape-design/components";

interface SideNavProps {
  activeHref?: string;
}

export function SideNav({ activeHref }: SideNavProps) {
  const isLocalhost = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const items = [
    ...(isLocalhost ? [{ type: "link" as const, text: "Edge Locations", href: "/edge-latency" }] : []),
    { type: "link" as const, text: "Datasets", href: "/datasets" },
    { type: "divider" as const },
    {
      type: "link" as const,
      text: "Source",
      href: "https://github.com/piotrekwitkowski/piotrekwitkowski.github.io",
      external: true,
    },
  ];

  return (
    <SideNavigation
      activeHref={activeHref}
      header={{ text: "Piotrek's Toolbox", href: "/" }}
      items={items}
    />
  );
}
