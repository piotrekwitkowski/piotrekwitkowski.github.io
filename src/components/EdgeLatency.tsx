import { useEffect, useState } from "react";
import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  Table,
  Box,
  Spinner,
  Alert,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { AppLayout } from "./AppLayout";
import { SideNav } from "./SideNav";

interface EdgeLocation {
  iata: string;
  city: string;
  country: string;
  country_code: string;
  nodes: Record<string, string>;
}

function EdgeLatency() {
  const [data, setData] = useState<EdgeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/static/cloudfront-edge-locations.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<EdgeLocation[]>;
      })
      .then((locations) => {
        setData(locations);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const { items, collectionProps } = useCollection(data, {
    sorting: {},
  });

  const content = loading ? (
    <Box textAlign="center" padding="xxl">
      <Spinner size="large" />
    </Box>
  ) : error ? (
    <Alert type="error" header="Failed to load data">
      {error}
    </Alert>
  ) : (
    <Table
      {...collectionProps}
      columnDefinitions={[
        {
          id: "country",
          header: "Country",
          cell: (item: EdgeLocation) => item.country,
          sortingField: "country",
        },
        {
          id: "city",
          header: "City",
          cell: (item: EdgeLocation) => item.city,
          sortingField: "city",
        },
        {
          id: "iata",
          header: "IATA",
          cell: (item: EdgeLocation) => item.iata,
          sortingField: "iata",
        },
        {
          id: "nodes",
          header: "Nodes",
          cell: (item: EdgeLocation) => Object.keys(item.nodes).join(", "),
        },
      ]}
      items={items}
      variant="embedded"
      contentDensity="compact"
      empty={
        <Box textAlign="center" color="text-body-secondary" padding="l">
          No data available.
        </Box>
      }
    />
  );

  return (
    <AppLayout
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: "Home", href: "/" },
              { text: "Edge Locations", href: "/edge-latency" },
            ]}
          />
        }
        navigation={<SideNav activeHref="/edge-latency" />}
        content={
          <ContentLayout
            header={
              <Header
                variant="h1"
                counter={loading ? undefined : `(${data.length})`}
              >
                Edge Locations
              </Header>
            }
          >
            {content}
          </ContentLayout>
        }
      />
  );
}

export default EdgeLatency;
