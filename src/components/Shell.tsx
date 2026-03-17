import React from "react";
import "@cloudscape-design/global-styles/index.css";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  SideNavigation,
  ContentLayout,
  SpaceBetween,
} from "@cloudscape-design/components";
import { ThemeProvider } from "../context/ThemeContext";

const TOOLS: { text: string; href: string; description: string }[] = [
  {
    text: "Datasets",
    href: "/datasets",
    description: "Public datasets available for download.",
  },
];

function Shell() {
  return (
    <ThemeProvider>
      <AppLayoutToolbar
      breadcrumbs={
        <BreadcrumbGroup
          items={[{ text: "Home", href: "/" }]}
        />
      }
      navigation={
        <SideNavigation
          header={{ text: "Piotrek's Toolbox", href: "/" }}
          items={[
            ...(TOOLS.length > 0
              ? TOOLS.map((t) => ({
                  type: "link" as const,
                  text: t.text,
                  href: t.href,
                }))
              : [{ type: "link" as const, text: "Home", href: "/" }]),
            { type: "divider" as const },
            {
              type: "link" as const,
              text: "Source",
              href: "https://github.com/piotrekwitkowski/piotrekwitkowski.github.io",
              external: true,
            },
          ]}
        />
      }
      toolsHide
      content={
        <ContentLayout>
          <SpaceBetween size="l">
            <svg
              viewBox="0 0 1600 500"
              style={{ maxWidth: 800, width: "100%", display: "block" }}
            >
              <rect width="1600" height="500" fill="rgb(0, 108, 224)" />
              <g
                fontFamily='"Amazon Ember Display", "Open Sans", "Helvetica Neue", Roboto, Arial, sans-serif'
                fill="#FFFFFF"
                fontWeight={700}
              >
                <text x="100" y="180" fontSize="100px">
                  Piotrek's Toolbox
                </text>
                <text x="100" y="300" fontSize="70px" fontWeight={400}>
                  Tools, datasets &amp; utilities
                </text>
                <text x="100" y="390" fontSize="70px" fontWeight={400}>
                  for cloud engineers
                </text>
              </g>
              {/* TODO: Add decorative graphic here */}
            </svg>
            <p style={{ margin: 0 }}>
              Use the navigation menu to browse available tools and resources.
            </p>
          </SpaceBetween>
        </ContentLayout>
      }
      />
    </ThemeProvider>
  );
}

export default Shell;
