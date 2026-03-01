import React from "react";
import "@cloudscape-design/global-styles/index.css";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  SideNavigation,
  TopNavigation,
  ContentLayout,
  Header,
  Container,
  SpaceBetween,
  Box,
  Link,
} from "@cloudscape-design/components";

const TOOLS: { text: string; href: string; description: string }[] = [];

function Shell() {
  return (
    <div id="app">
      <TopNavigation
        identity={{
          href: "/",
          title: "Piotrek's Toolbox",
        }}
        i18nStrings={{ overflowMenuTriggerText: "More" }}
      />
      <AppLayoutToolbar
        breadcrumbs={
          <BreadcrumbGroup
            items={[{ text: "Home", href: "/" }]}
          />
        }
        navigation={
          <SideNavigation
            header={{ text: "Tools", href: "/" }}
            items={
              TOOLS.length > 0
                ? TOOLS.map((t) => ({
                    type: "link" as const,
                    text: t.text,
                    href: t.href,
                  }))
                : [{ type: "link" as const, text: "Home", href: "/" }]
            }
          />
        }
        toolsHide
        content={
          <ContentLayout
            header={<Header variant="h1">Piotrek's Toolbox</Header>}
          >
            <SpaceBetween size="l">
              {TOOLS.length > 0 ? (
                TOOLS.map((tool) => (
                  <Container
                    key={tool.href}
                    header={
                      <Header>
                        <Link href={tool.href}>{tool.text}</Link>
                      </Header>
                    }
                  >
                    {tool.description}
                  </Container>
                ))
              ) : (
                <Container>
                  <Box variant="p" color="text-body-secondary">
                    No tools yet. Add entries to the TOOLS array in{" "}
                    <Box variant="code">src/components/Shell.tsx</Box> to get
                    started.
                  </Box>
                </Container>
              )}
            </SpaceBetween>
          </ContentLayout>
        }
      />
    </div>
  );
}

export default Shell;
