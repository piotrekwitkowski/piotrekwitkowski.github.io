import { useEffect, useState } from "react";
import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  Table,
  Box,
  Spinner,
  Alert,
  Button,
  Badge,
  TextFilter,
} from "@cloudscape-design/components";
import { AppLayout } from "./AppLayout";
import { SideNav } from "./SideNav";
import { DATASETS } from "../config/datasets";

interface PslEntry {
  suffix: string;
  type: string;
  wildcard: boolean;
  exception: boolean;
}

interface TreeItem {
  id: string;
  suffix: string;
  label: string;
  type: string;
  wildcard: boolean;
  exception: boolean;
  childCount: number;
  children?: TreeItem[];
}

function buildTree(entries: PslEntry[]): TreeItem[] {
  const byParent = new Map<string, PslEntry[]>();

  for (const entry of entries) {
    const parts = entry.suffix.split(".");
    const parent = parts.length === 1 ? "" : parts.slice(1).join(".");
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(entry);
  }

  function build(parentSuffix: string): TreeItem[] {
    const children = byParent.get(parentSuffix) ?? [];
    return children
      .sort((a, b) => a.suffix.localeCompare(b.suffix))
      .map((entry) => {
        const nested = build(entry.suffix);
        return {
          id: entry.suffix,
          suffix: entry.suffix,
          label: entry.suffix.split(".")[0],
          type: entry.type,
          wildcard: entry.wildcard,
          exception: entry.exception,
          childCount: nested.length,
          children: nested.length > 0 ? nested : undefined,
        };
      });
  }

  return build("");
}

export default function PublicSuffixExplorer() {
  const [data, setData] = useState<PslEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<TreeItem[]>([]);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    fetch("/static/public-suffix-list.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const fullTree = data.length > 0 ? buildTree(data) : [];

  function filterTree(items: TreeItem[], text: string): TreeItem[] {
    if (!text) return items;
    const lower = text.toLowerCase();
    return items
      .map((item) => {
        const childMatches = item.children ? filterTree(item.children, text) : [];
        const selfMatches = item.suffix.toLowerCase().includes(lower);
        if (!selfMatches && childMatches.length === 0) return null;
        return { ...item, children: childMatches.length > 0 ? childMatches : item.children };
      })
      .filter(Boolean) as TreeItem[];
  }

  const tree = filterTree(fullTree, filterText);

  const dataset = DATASETS.find((d) => d.name === "public-suffix-list");

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
      columnDefinitions={[
        {
          id: "suffix",
          header: "Suffix",
          cell: (item) => item.suffix,
          sortingField: "suffix",
          isRowHeader: true,
        },
        {
          id: "type",
          header: "Type",
          cell: (item) => (
            <Badge color={item.type === "ICANN" ? "blue" : "grey"}>
              {item.type}
            </Badge>
          ),
          sortingField: "type",
        },
      ]}
      filter={
        <TextFilter
          filteringText={filterText}
          filteringPlaceholder="Find suffix"
          onChange={({ detail }) => setFilterText(detail.filteringText)}
        />
      }
      items={tree}
      trackBy="id"
      variant="embedded"
      contentDensity="compact"
      expandableRows={{
        getItemChildren: (item) => item.children ?? [],
        isItemExpandable: (item) => Boolean(item.children?.length),
        expandedItems,
        onExpandableItemToggle: ({ detail }) => {
          setExpandedItems((prev) => {
            const next = new Set(prev.map((i) => i.id));
            if (detail.expanded) {
              next.add(detail.item.id);
            } else {
              next.delete(detail.item.id);
            }
            return [...next].map((id) => ({ id }) as TreeItem);
          });
        },
      }}
      getLoadingStatus={() => "finished"}
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
            { text: "Datasets", href: "/datasets" },
            { text: "Public Suffix List", href: "/datasets/public-suffix-list" },
          ]}
        />
      }
      navigation={<SideNav activeHref="/datasets" />}
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description={dataset?.description}
              counter={loading ? undefined : `(${data.length})`}
              actions={
                <Button
                  href="/static/public-suffix-list.json"
                  iconName="download"
                  target="_blank"
                >
                  JSON
                </Button>
              }
            >
              Public Suffix List
            </Header>
          }
        >
          {content}
        </ContentLayout>
      }
    />
  );
}
