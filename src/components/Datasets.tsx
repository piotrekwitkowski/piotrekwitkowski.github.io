import React from "react";
import "@cloudscape-design/global-styles/index.css";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Link,
  Table,
  Badge,
  Box,
} from "@cloudscape-design/components";
import { ThemeProvider } from "../context/ThemeContext";
import { SideNav } from "./SideNav";

const DATASETS = [
  {
    name: "cloudfront-edge-locations.json",
    description: "CloudFront POP locations with IATA codes, cities, countries, and active node identifiers.",
    href: "/static/cloudfront-edge-locations.json",
    format: "JSON",
  },
  {
    name: "cloudfront-embedded-pops.json",
    description: "CloudFront Embedded PoP locations (caches within ISP networks) by city and country.",
    href: "/static/cloudfront-embedded-pops.json",
    format: "JSON",
  },
  {
    name: "airport-coordinates.json",
    description: "Geo coordinates (latitude/longitude) for airports associated with CloudFront edge locations.",
    href: "/static/airport-coordinates.json",
    format: "JSON",
  },
];

function Datasets() {
  return (
    <ThemeProvider>
      <AppLayoutToolbar
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            { text: "Home", href: "/" },
            { text: "Datasets", href: "/datasets" },
          ]}
        />
      }
      navigation={<SideNav activeHref="/datasets" />}
      toolsHide
      content={
        <ContentLayout
          header={<Header variant="h1">Datasets</Header>}
        >
          <SpaceBetween size="l">
            <Table
              columnDefinitions={[
                {
                  id: "name",
                  header: "Name",
                  cell: (item) => (
                    <Link href={item.href} external>{item.name}</Link>
                  ),
                },
                {
                  id: "format",
                  header: "Format",
                  cell: (item) => <Badge color="blue">{item.format}</Badge>,
                },
                {
                  id: "description",
                  header: "Description",
                  cell: (item) => item.description,
                },
              ]}
              items={[...DATASETS].sort((a, b) => a.name.localeCompare(b.name))}
              variant="embedded"
              empty={
                <Box textAlign="center" color="text-body-secondary" padding="l">
                  No datasets available.
                </Box>
              }
            />
          </SpaceBetween>
        </ContentLayout>
      }
      />
    </ThemeProvider>
  );
}

export default Datasets;
