import React from "react";
import "@cloudscape-design/global-styles/index.css";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  SideNavigation,
  ContentLayout,
  Header,
  SpaceBetween,
  Container,
} from "@cloudscape-design/components";
import { ThemeProvider } from "../context/ThemeContext";

function CloudFront() {
  return (
    <ThemeProvider>
      <AppLayoutToolbar
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: "Home", href: "/" },
              { text: "CloudFront", href: "/cloudfront" },
            ]}
          />
        }
        navigation={
          <SideNavigation
            activeHref="/cloudfront"
            header={{ text: "Piotrek's Toolbox", href: "/" }}
            items={[
              {
                type: "section" as const,
                text: "CloudFront",
                items: [
                  { type: "link" as const, text: "CloudFront", href: "/cloudfront" },
                  { type: "link" as const, text: "Latency Simulator", href: "/edge-latency" },
                ],
              },
              { type: "divider" as const },
              { type: "link" as const, text: "Datasets", href: "/datasets" },
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
          <ContentLayout
            header={<Header variant="h1">CloudFront</Header>}
          >
            <SpaceBetween size="l">
              <Container>
                CloudFront tools and resources.
              </Container>
            </SpaceBetween>
          </ContentLayout>
        }
      />
    </ThemeProvider>
  );
}

export default CloudFront;
