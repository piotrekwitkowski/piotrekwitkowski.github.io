import React, { useEffect, useState, useMemo } from "react";
import "@cloudscape-design/global-styles/index.css";
import {
  AppLayoutToolbar,
  BreadcrumbGroup,
  SideNavigation,
  ContentLayout,
  Header,
  SpaceBetween,
  Table,
  Box,
  Container,
  FormField,
  Input,
  Spinner,
  ColumnLayout,
  Alert,
} from "@cloudscape-design/components";
import { ThemeProvider } from "../context/ThemeContext";

const TOOLS = [
  { text: "Datasets", href: "/datasets" },
  { text: "Latency Simulator", href: "/edge-latency" },
];

interface Pop {
  iata: string;
  city: string;
  country: string;
  countryCode: string;
  recRegion: string;
  ttfbByRegion: Record<string, number>;
}

interface Measurement {
  timestamp: string;
  candidateRegions: string[];
  pops: Pop[];
}

interface EdgeLocation {
  iata_code: string;
  city: string;
  country: string;
  country_code: string;
  active_nodes: string[];
}

interface TableRow {
  iata: string;
  city: string;
  country: string;
  recRegion: string;
  routedTo: string;
  ttfb: number;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const results: T[][] = [];
  const first = arr[0];
  const rest = arr.slice(1);
  for (const combo of combinations(rest, k - 1)) {
    results.push([first, ...combo]);
  }
  for (const combo of combinations(rest, k)) {
    results.push(combo);
  }
  return results;
}

function routePop(pop: Pop, selectedRegions: string[]): { region: string; ttfb: number } {
  let bestRegion = selectedRegions[0];
  let bestTtfb = pop.ttfbByRegion[bestRegion] ?? Infinity;
  for (let i = 1; i < selectedRegions.length; i++) {
    const r = selectedRegions[i];
    const t = pop.ttfbByRegion[r] ?? Infinity;
    if (t < bestTtfb) {
      bestTtfb = t;
      bestRegion = r;
    }
  }
  return { region: bestRegion, ttfb: bestTtfb };
}

function findOptimalRegionsBruteForce(
  pops: Pop[],
  candidateRegions: string[],
  maxRegions: number,
  ttfbTarget: number,
): string[] {
  const mustInclude = "us-east-1";
  const others = candidateRegions.filter((r) => r !== mustInclude);
  const slotsForOthers = Math.min(maxRegions - 1, others.length);

  let bestSet: string[] = [mustInclude];
  let bestViolations = Infinity;

  for (const combo of combinations(others, slotsForOthers)) {
    const selected = [mustInclude, ...combo];
    let violations = 0;
    for (const pop of pops) {
      const { ttfb } = routePop(pop, selected);
      if (ttfb > ttfbTarget) violations++;
    }
    if (violations < bestViolations) {
      bestViolations = violations;
      bestSet = selected;
      if (violations === 0) break;
    }
  }
  return bestSet;
}

function findOptimalRegionsGreedy(
  pops: Pop[],
  candidateRegions: string[],
  maxRegions: number,
  ttfbTarget: number,
): string[] {
  const mustInclude = "us-east-1";
  const selected = [mustInclude];
  const remaining = new Set(candidateRegions.filter((r) => r !== mustInclude));

  while (selected.length < maxRegions && remaining.size > 0) {
    let bestCandidate = "";
    let bestViolations = Infinity;

    for (const candidate of remaining) {
      const trial = [...selected, candidate];
      let violations = 0;
      for (const pop of pops) {
        const { ttfb } = routePop(pop, trial);
        if (ttfb > ttfbTarget) violations++;
      }
      if (violations < bestViolations) {
        bestViolations = violations;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) break;
    selected.push(bestCandidate);
    remaining.delete(bestCandidate);

    if (bestViolations === 0) break;
  }

  return selected;
}

function EdgeLatency() {
  const [data, setData] = useState<Measurement | null>(null);
  const [edgeLocations, setEdgeLocations] = useState<EdgeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxRegionsValue, setMaxRegionsValue] = useState("3");
  const [ttfbTargetValue, setTtfbTargetValue] = useState("100");
  const [sortingColumn, setSortingColumn] = useState<{ sortingField?: string }>({ sortingField: "country" });
  const [sortingDescending, setSortingDescending] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/static/edge-latency-measurements.json").then((res) => {
        if (!res.ok) throw new Error(`Measurements: HTTP ${res.status}`);
        return res.json() as Promise<Measurement>;
      }),
      fetch("/static/cloudfront-edge-locations.json").then((res) => {
        if (!res.ok) throw new Error(`Edge locations: HTTP ${res.status}`);
        return res.json() as Promise<EdgeLocation[]>;
      }),
    ])
      .then(([measurements, locations]) => {
        setData(measurements);
        setEdgeLocations(locations);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const maxRegions = Math.max(1, parseInt(maxRegionsValue, 10) || 1);
  const ttfbTarget = Math.max(1, parseInt(ttfbTargetValue, 10) || 100);

  const selectedRegions = useMemo(() => {
    if (!data) return [];
    const capped = Math.min(maxRegions, data.candidateRegions.length);
    if (capped > 6) {
      return findOptimalRegionsGreedy(data.pops, data.candidateRegions, capped, ttfbTarget);
    }
    return findOptimalRegionsBruteForce(data.pops, data.candidateRegions, capped, ttfbTarget);
  }, [data, maxRegions, ttfbTarget]);

  const locationMap = useMemo(() => {
    const map = new Map<string, EdgeLocation>();
    for (const loc of edgeLocations) {
      map.set(loc.iata_code, loc);
    }
    return map;
  }, [edgeLocations]);

  const tableRows = useMemo((): TableRow[] => {
    if (!data || selectedRegions.length === 0) return [];
    return data.pops
      .map((pop) => {
        const { region, ttfb } = routePop(pop, selectedRegions);
        const loc = locationMap.get(pop.iata);
        return {
          iata: pop.iata,
          city: loc?.city ?? pop.city,
          country: loc?.country ?? pop.country,
          recRegion: pop.recRegion,
          routedTo: region,
          ttfb: Math.round(ttfb),
        };
      });
  }, [data, selectedRegions, locationMap]);

  const sortedRows = useMemo(() => {
    const field = sortingColumn.sortingField as keyof TableRow | undefined;
    if (!field) return tableRows;
    const sorted = [...tableRows].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      if (cmp !== 0) return cmp;
      return a.city.localeCompare(b.city);
    });
    return sortingDescending ? sorted.reverse() : sorted;
  }, [tableRows, sortingColumn, sortingDescending]);

  const withinTarget = tableRows.filter((r) => r.ttfb <= ttfbTarget).length;
  const totalPops = tableRows.length;

  const content = loading ? (
    <Box textAlign="center" padding="xxl">
      <Spinner size="large" />
    </Box>
  ) : error ? (
    <Alert type="error" header="Failed to load measurements">
      {error}
    </Alert>
  ) : (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Simulator</Header>}>
        <SpaceBetween size="l">
          <ColumnLayout columns={2}>
            <FormField
              label="Max regions"
              description={`1–${data?.candidateRegions.length ?? 1}`}
            >
              <Input
                type="number"
                value={maxRegionsValue}
                onChange={({ detail }) => setMaxRegionsValue(detail.value)}
                inputMode="numeric"
              />
            </FormField>
            <FormField label="TTFB target (ms)">
              <Input
                type="number"
                value={ttfbTargetValue}
                onChange={({ detail }) => setTtfbTargetValue(detail.value)}
                inputMode="numeric"
              />
            </FormField>
          </ColumnLayout>
          <Alert type="info">
            <SpaceBetween size="xxs" direction="horizontal">
              <Box>
                <strong>Selected regions:</strong>{" "}
                {selectedRegions.join(", ")}
              </Box>
              <Box>|</Box>
              <Box>
                <strong>{withinTarget} of {totalPops}</strong> POPs within{" "}
                {ttfbTarget}ms target
              </Box>
            </SpaceBetween>
          </Alert>
        </SpaceBetween>
      </Container>
      <Table
        header={<Header variant="h2">Results</Header>}
        sortingColumn={sortingColumn}
        sortingDescending={sortingDescending}
        onSortingChange={({ detail }) => {
          setSortingColumn(detail.sortingColumn);
          setSortingDescending(detail.isDescending ?? false);
        }}
        columnDefinitions={[
          {
            id: "country",
            header: "Country",
            cell: (item: TableRow) => item.country,
            sortingField: "country",
          },
          {
            id: "city",
            header: "City",
            cell: (item: TableRow) => item.city,
            sortingField: "city",
          },
          {
              id: "iata",
              header: "IATA",
              cell: (item: TableRow) => item.iata,
              sortingField: "iata",
          },
          {
            id: "recRegion",
            header: "REC Region",
            cell: (item: TableRow) => item.recRegion,
            sortingField: "recRegion",
          },
          {
            id: "routedTo",
            header: "Routed To",
            cell: (item: TableRow) => item.routedTo,
            sortingField: "routedTo",
          },
          {
            id: "ttfb",
            header: "TTFB (ms)",
            cell: (item: TableRow) => item.ttfb,
            sortingField: "ttfb",
          },
        ]}
        items={sortedRows}
        variant="embedded"
        contentDensity="compact"
        empty={
          <Box textAlign="center" color="text-body-secondary" padding="l">
            No measurement data available.
          </Box>
        }
      />
    </SpaceBetween>
  );

  return (
    <ThemeProvider>
      <AppLayoutToolbar
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: "Home", href: "/" },
              { text: "Latency Simulator", href: "/edge-latency" },
            ]}
          />
        }
        navigation={
          <SideNavigation
            activeHref="/edge-latency"
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
            header={<Header variant="h1">Latency Simulator</Header>}
          >
            {content}
          </ContentLayout>
        }
      />
    </ThemeProvider>
  );
}

export default EdgeLatency;
