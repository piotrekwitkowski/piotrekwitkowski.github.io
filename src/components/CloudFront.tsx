import React from "react";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Container,
} from "@cloudscape-design/components";
import { ThemeProvider } from "../context/ThemeContext";
import { SideNav } from "./SideNav";

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
        navigation={<SideNav activeHref="/cloudfront" />}
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
