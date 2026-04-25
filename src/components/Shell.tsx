import React from "react";
import {
  BreadcrumbGroup,
  ContentLayout,
  SpaceBetween,
} from "@cloudscape-design/components";
import { AppLayout } from "./AppLayout";
import { SideNav } from "./SideNav";

function Shell() {
  return (
    <AppLayout
      breadcrumbs={
        <BreadcrumbGroup
          items={[{ text: "Home", href: "/" }]}
        />
      }
      maxContentWidth={Number.MAX_SAFE_INTEGER}
      navigation={<SideNav />}
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
  );
}

export default Shell;
