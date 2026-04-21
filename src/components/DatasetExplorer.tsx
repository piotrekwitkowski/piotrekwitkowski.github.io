import React, { useEffect, useState } from "react";
import "@cloudscape-design/global-styles/index.css";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Table,
  Box,
  Spinner,
  Alert,
  Button,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { ThemeProvider } from "../context/ThemeContext";
import { SideNav } from "./SideNav";
import { DATASETS } from "../config/datasets";

interface DatasetExplorerProps {
  datasetName: string;
}

function DatasetExplorer({ datasetName }: DatasetExplorerProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/static/${datasetName}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!Array.isArray(json)) {
          throw new Error("Expected JSON array");
        }
        setData(json);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [datasetName]);

  const columns = (() => {
    if (data.length === 0) return [];
    const firstItem = data[0];
    return Object.keys(firstItem).map((key) => ({
      id: key,
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
      cell: (item: any) => {
        const value = item[key];
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        if (typeof value === "object" && value !== null) {
          return JSON.stringify(value);
        }
        return String(value ?? "");
      },
      sortingField: key,
    }));
  })();

  const { items, collectionProps } = useCollection(data, {
    sorting: {},
  });

  const content = loading ? (
    <Box textAlign="center" padding="xxl">
      <Spinner size="large" />
    </Box>
  ) : error ? (
    <Alert type="error" header="Failed to load dataset">
      {error}
    </Alert>
  ) : (
    <Table
      {...collectionProps}
      columnDefinitions={columns}
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

  const displayName = datasetName
    .replace(/-/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const dataset = DATASETS.find((d) => d.name === datasetName);
  const description = dataset?.description ?? "";

  return (
    <ThemeProvider>
      <AppLayoutToolbar
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: "Home", href: "/" },
              { text: "Datasets", href: "/datasets" },
              { text: displayName, href: `/datasets/${datasetName}` },
            ]}
          />
        }
        navigation={<SideNav activeHref="/datasets" />}
        toolsHide
        content={
          <ContentLayout
            header={
              <Header
                variant="h1"
                description={description}
                counter={loading ? undefined : `(${data.length})`}
                actions={
                  <Button
                    href={`/static/${datasetName}.json`}
                    iconName="download"
                    target="_blank"
                  >
                    JSON
                  </Button>
                }
              >
                {displayName}
              </Header>
            }
          >
            {content}
          </ContentLayout>
        }
      />
    </ThemeProvider>
  );
}

export default DatasetExplorer;
