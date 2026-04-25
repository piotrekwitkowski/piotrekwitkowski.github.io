import React, { useEffect, useState } from "react";
import {
  BreadcrumbGroup,
  CollectionPreferences,
  ContentLayout,
  Header,
  SpaceBetween,
  Table,
  Box,
  Spinner,
  Alert,
  Button,
  Pagination,
} from "@cloudscape-design/components";
import { CodeView } from "@cloudscape-design/code-view";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { AppLayout } from "./AppLayout";
import { SideNav } from "./SideNav";
import { DATASETS } from "../config/datasets";

interface DatasetExplorerProps {
  datasetName: string;
}

function DatasetExplorer({ datasetName }: DatasetExplorerProps) {
  const [data, setData] = useState<any[]>([]);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dataset = DATASETS.find((d) => d.name === datasetName);
  const isTxt = dataset?.format === "TXT";
  const ext = isTxt ? "txt" : "json";

  useEffect(() => {
    fetch(`/static/${datasetName}.${ext}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return isTxt ? res.text() : res.json();
      })
      .then((result) => {
        if (isTxt) {
          setTextContent(result as string);
        } else {
          if (!Array.isArray(result)) throw new Error("Expected JSON array");
          setData(result);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [datasetName, ext, isTxt]);

  const columns = (() => {
    if (data.length === 0) return [];
    const firstItem = data[0];
    return Object.keys(firstItem).map((key) => ({
      id: key,
      header: { asn: "ASN", dnssec: "DNSSEC", iata: "IATA", ipv4: "IPv4", ipv6: "IPv6" }[key]
        ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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

  const paginate = data.length > 1000;
  const [pageSize, setPageSize] = useState(500);

  const { items, collectionProps, paginationProps } = useCollection(data, {
    sorting: {},
    pagination: paginate ? { pageSize } : undefined,
  });

  const lineCount = textContent?.trim().split("\n").length ?? 0;

  const content = loading ? (
    <Box textAlign="center" padding="xxl">
      <Spinner size="large" />
    </Box>
  ) : error ? (
    <Alert type="error" header="Failed to load dataset">
      {error}
    </Alert>
  ) : isTxt ? (
    <div style={{ maxHeight: "70vh", overflow: "auto" }}>
      <CodeView content={textContent ?? ""} lineNumbers />
    </div>
  ) : (
    <Table
      {...collectionProps}
      columnDefinitions={columns}
      items={items}
      variant="embedded"
      contentDensity="compact"
      pagination={paginate ? <Pagination {...paginationProps} /> : undefined}
      preferences={paginate ?
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          pageSizePreference={{
            title: "Page size",
            options: [
              { value: 250, label: "250" },
              { value: 500, label: "500" },
              { value: 1000, label: "1000" },
            ],
          }}
          preferences={{ pageSize }}
          onConfirm={({ detail }) => setPageSize(detail.pageSize ?? 500)}
        /> : undefined
      }
      empty={
        <Box textAlign="center" color="text-body-secondary" padding="l">
          No data available.
        </Box>
      }
    />
  );

  const displayName = dataset?.displayName ?? datasetName;
  const description = dataset?.description ?? "";

  return (
    <AppLayout
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
        content={
          <ContentLayout
            header={
              <Header
                variant="h1"
                description={description}
                counter={loading ? undefined : `(${isTxt ? lineCount : data.length})`}
                actions={
                  <Button
                    href={`/static/${datasetName}.${ext}`}
                    iconName="download"
                    target="_blank"
                  >
                    {ext.toUpperCase()}
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
  );
}

export default DatasetExplorer;
