import { useCallback, useEffect, useRef, useState } from "react";
import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Container,
  Input,
  Button,
  Table,
  Box,
  Spinner,
  Alert,
  KeyValuePairs,
  StatusIndicator,
  Tabs,
  ColumnLayout,
  Link,
  Badge,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { AppLayout } from "./AppLayout";
import { SideNav } from "./SideNav";

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA"] as const;

interface DnsRecord {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  data: string;
  TTL: number;
  collapsedData?: string;
}

interface RdapData {
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  lastChanged: string | null;
  nameservers: string[];
  dnssecSigned: boolean | null;
  status: string[];
}

interface PslEntry {
  suffix: string;
  type: "ICANN" | "PRIVATE";
  wildcard: boolean;
  exception: boolean;
}

interface PslResult {
  etld: string;
  etldType: "ICANN" | "PRIVATE";
  registrableDomain: string | null;
  subdomain: string | null;
}

interface RegistryEntry {
  rank: number;
  domain: string;
  registrar: string;
  created: string;
  expires: string;
  nameservers: string;
  dnssec: boolean;
}

const DNS_TYPE_MAP: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  257: "CAA",
};

function sanitizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.split("/")[0];
  domain = domain.split(":")[0];
  return domain;
}

function getDomainFromUrl(): string {
  return new URLSearchParams(window.location.search).get("domain") ?? "";
}

function parsePsl(domain: string, psl: PslEntry[]): PslResult | null {
  const labels = domain.split(".");
  if (labels.length < 2) return null;

  const suffixSet = new Map<string, PslEntry>();
  for (const entry of psl) {
    suffixSet.set(entry.suffix, entry);
  }

  let bestMatch: PslEntry | null = null;
  let bestLength = 0;

  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join(".");

    const exact = suffixSet.get(candidate);
    if (exact && !exact.exception) {
      const len = labels.length - i;
      if (len > bestLength) {
        bestMatch = exact;
        bestLength = len;
      }
    }

    if (i > 0) {
      const wildcardCandidate = "*." + labels.slice(i).join(".");
      const wildcard = suffixSet.get(wildcardCandidate);
      if (wildcard && !wildcard.exception) {
        const len = labels.length - i + 1;
        if (len > bestLength) {
          bestMatch = { ...wildcard, suffix: candidate };
          bestLength = len;
        }
      }
    }

    const exception = suffixSet.get(candidate);
    if (exception?.exception) {
      const parentSuffix = labels.slice(i + 1).join(".");
      const parentEntry = suffixSet.get("*." + parentSuffix);
      if (parentEntry) {
        bestMatch = { ...parentEntry, suffix: parentSuffix };
        bestLength = labels.length - i - 1;
      }
    }
  }

  if (!bestMatch) {
    const tld = labels[labels.length - 1];
    return {
      etld: tld,
      etldType: "ICANN",
      registrableDomain: labels.length >= 2 ? labels.slice(-2).join(".") : null,
      subdomain: labels.length > 2 ? labels.slice(0, -2).join(".") : null,
    };
  }

  const etld = bestMatch.suffix;
  const etldLabels = etld.split(".");
  const regLabels = etldLabels.length + 1;

  if (labels.length < regLabels) return { etld, etldType: bestMatch.type, registrableDomain: null, subdomain: null };

  const registrableDomain = labels.slice(-regLabels).join(".");
  const subdomain = labels.length > regLabels ? labels.slice(0, -regLabels).join(".") : null;

  return { etld, etldType: bestMatch.type, registrableDomain, subdomain };
}

function detectCloudFront(records: DnsRecord[]): string | null {
  for (const r of records) {
    if (r.type === "CNAME" && r.data.endsWith(".cloudfront.net.")) {
      return r.data;
    }
  }
  return null;
}

async function fetchDnsRecords(domain: string): Promise<DnsRecord[]> {
  const flat: { type: string; name: string; data: string; TTL: number }[] = [];

  const queries = DNS_TYPES.map(async (type) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) return;
    const json = await res.json();
    if (!json.Answer) return;
    for (const answer of json.Answer) {
      flat.push({
        type: DNS_TYPE_MAP[answer.type] ?? String(answer.type),
        name: answer.name,
        data: answer.data.replace(/^"|"$/g, ""),
        TTL: answer.TTL,
      });
    }
  });

  await Promise.all(queries);
  flat.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name) || a.data.localeCompare(b.data));

  function txtPrefix(data: string): string {
    const unquoted = data.replace(/^"|"$/g, "");
    const eqIdx = unquoted.indexOf("=");
    if (eqIdx === -1) return unquoted.split(/\s/)[0];
    const key = unquoted.slice(0, eqIdx);
    if (key === "v") {
      const val = unquoted.slice(eqIdx + 1).split(/[\s;]/)[0];
      return `v=${val}`;
    }
    return key;
  }

  const txtByPrefix = new Map<string, typeof flat>();
  for (const r of flat) {
    if (r.type === "TXT") {
      const prefix = txtPrefix(r.data);
      const list = txtByPrefix.get(prefix) ?? [];
      list.push(r);
      txtByPrefix.set(prefix, list);
    }
  }

  const groupedTxtPrefixes = new Set<string>();
  for (const [prefix, records] of txtByPrefix) {
    if (records.length > 1) groupedTxtPrefixes.add(prefix);
  }

  let idx = 0;
  const emittedGroups = new Set<string>();
  const results: DnsRecord[] = [];
  for (const r of flat) {
    if (r.type === "TXT" && groupedTxtPrefixes.has(txtPrefix(r.data))) {
      const prefix = txtPrefix(r.data);
      if (emittedGroups.has(prefix)) continue;
      emittedGroups.add(prefix);
      const records = txtByPrefix.get(prefix)!;
      const groupId = `txt-${prefix}`;
      const allSameTtl = records.every((r) => r.TTL === records[0].TTL);
      results.push({
        id: groupId,
        parentId: null,
        type: "TXT",
        name: records[0].name,
        data: prefix,
        collapsedData: `${records[0].data} + ${records.length - 1} more`,
        TTL: allSameTtl ? records[0].TTL : 0,
      });
      for (let i = 0; i < records.length; i++) {
        results.push({
          id: `${groupId}-${i}`,
          parentId: groupId,
          ...records[i],
        });
      }
      continue;
    }
    results.push({ id: `r-${idx++}`, parentId: null, ...r });
  }

  results.sort((a, b) => {
    const typeA = a.parentId ? "" : a.type;
    const typeB = b.parentId ? "" : b.type;
    return typeA.localeCompare(typeB) || a.name.localeCompare(b.name);
  });

  return results;
}

async function fetchRdap(domain: string): Promise<RdapData> {
  const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
  if (!res.ok) throw new Error(`RDAP lookup failed (HTTP ${res.status})`);
  const json = await res.json();

  const events = json.events ?? [];
  const findEvent = (action: string) =>
    events.find((e: { eventAction: string }) => e.eventAction === action)?.eventDate ?? null;

  const registrarEntity = (json.entities ?? []).find(
    (e: { roles?: string[] }) => e.roles?.includes("registrar"),
  );
  const registrar =
    registrarEntity?.vcardArray?.[1]?.find(
      (v: string[]) => v[0] === "fn",
    )?.[3] ?? null;

  const nameservers = (json.nameservers ?? []).map(
    (ns: { ldhName: string }) => ns.ldhName?.toLowerCase(),
  ).filter(Boolean);

  return {
    registrar,
    registrationDate: findEvent("registration"),
    expirationDate: findEvent("expiration"),
    lastChanged: findEvent("last changed"),
    nameservers,
    dnssecSigned: json.secureDNS?.delegationSigned ?? null,
    status: json.status ?? [],
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DomainLookup() {
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[] | null>(null);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [rdapData, setRdapData] = useState<RdapData | null>(null);
  const [rdapError, setRdapError] = useState<string | null>(null);
  const [queriedDomain, setQueriedDomain] = useState<string | null>(null);
  const [pslResult, setPslResult] = useState<PslResult | null>(null);
  const [registryMatch, setRegistryMatch] = useState<RegistryEntry | null>(null);
  const [cloudFrontCname, setCloudFrontCname] = useState<string | null>(null);

  const inputRef = useRef<HTMLDivElement>(null);
  const pslRef = useRef<PslEntry[] | null>(null);
  const registryRef = useRef<RegistryEntry[] | null>(null);
  const datasetsReady = useRef(false);
  const pendingLookup = useRef<string | null>(null);

  const runLookup = useCallback(async (domain: string) => {
    setLoading(true);
    setDnsRecords(null);
    setDnsError(null);
    setRdapData(null);
    setRdapError(null);
    setPslResult(null);
    setRegistryMatch(null);
    setCloudFrontCname(null);
    setQueriedDomain(domain);

    if (pslRef.current) {
      const psl = parsePsl(domain, pslRef.current);
      setPslResult(psl);

      const lookupDomain = psl?.registrableDomain ?? domain;
      const match = registryRef.current?.find((e) => e.domain === lookupDomain) ?? null;
      setRegistryMatch(match);
    }

    const [dnsResult, rdapResult] = await Promise.allSettled([
      fetchDnsRecords(domain),
      fetchRdap(domain),
    ]);

    if (dnsResult.status === "fulfilled") {
      setDnsRecords(dnsResult.value);
      setCloudFrontCname(detectCloudFront(dnsResult.value));
    } else {
      setDnsError(dnsResult.reason?.message ?? "DNS lookup failed");
    }

    if (rdapResult.status === "fulfilled") {
      setRdapData(rdapResult.value);
    } else {
      setRdapError(rdapResult.reason?.message ?? "RDAP lookup failed");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/static/public-suffix-list.json").then((r) => r.json() as Promise<PslEntry[]>),
      fetch("/static/domain-registry.json").then((r) => r.json() as Promise<RegistryEntry[]>),
    ]).then(([psl, registry]) => {
      pslRef.current = psl;
      registryRef.current = registry;
      datasetsReady.current = true;
      if (pendingLookup.current) {
        runLookup(pendingLookup.current);
        pendingLookup.current = null;
      }
    });
  }, [runLookup]);

  useEffect(() => {
    const domain = getDomainFromUrl();
    if (domain) {
      setDomainInput(domain);
      if (datasetsReady.current) {
        runLookup(domain);
      } else {
        pendingLookup.current = domain;
      }
    } else {
      inputRef.current?.querySelector("input")?.focus();
    }
  }, [runLookup]);

  const handleLookup = () => {
    const domain = sanitizeDomain(domainInput);
    if (!domain) return;
    const url = new URL(window.location.href);
    url.searchParams.set("domain", domain);
    window.history.pushState(null, "", url);
    runLookup(domain);
  };

  const insightsItems = [];

  if (pslResult) {
    insightsItems.push(
      { label: "Effective TLD", value: <>{pslResult.etld} <Badge color={pslResult.etldType === "ICANN" ? "blue" : "grey"}>{pslResult.etldType}</Badge></> },
      { label: "Registrable domain (eTLD+1)", value: pslResult.registrableDomain ?? "—" },
      { label: "Subdomain", value: pslResult.subdomain ?? "—" },
    );
  }

  const [expandedDnsItems, setExpandedDnsItems] = useState<DnsRecord[]>([]);
  const { items: dnsItems, collectionProps: dnsCollectionProps } = useCollection(dnsRecords ?? [], {
    sorting: {},
    expandableRows: {
      getId: (item) => item.id,
      getParentId: (item) => item.parentId,
    },
  });

  const expandedDnsIds = new Set(expandedDnsItems.map((i) => i.id));

  const dnsContent = dnsError ? (
    <Alert type="error">{dnsError}</Alert>
  ) : dnsRecords ? (
    <Table
      {...dnsCollectionProps}
      items={dnsItems}
      expandableRows={{
        ...dnsCollectionProps.expandableRows!,
        expandedItems: expandedDnsItems,
        onExpandableItemToggle: ({ detail }) => {
          setExpandedDnsItems((prev) =>
            prev.some((i) => i.id === detail.item.id)
              ? prev.filter((i) => i.id !== detail.item.id)
              : [...prev, detail.item],
          );
        },
      }}
      columnDefinitions={[
        {
          id: "type",
          header: "Type",
          cell: (item) => item.type,
          sortingField: "type",
          counter: ({ item, itemsCount }) =>
            item.parentId === null && itemsCount ? `(${itemsCount})` : null,
        },
        {
          id: "data",
          header: "Value",
          cell: (item) =>
            item.collapsedData && !expandedDnsIds.has(item.id)
              ? item.collapsedData
              : item.data,
        },
        { id: "ttl", header: "TTL", cell: (item) => item.TTL ? `${item.TTL}s` : "" },
      ]}
      variant="embedded"
      contentDensity="compact"
      empty={
        <Box textAlign="center" color="text-body-secondary" padding="l">
          No DNS records found.
        </Box>
      }
    />
  ) : null;

  const rdapContent = rdapError ? (
    <Alert type="info">{rdapError}</Alert>
  ) : rdapData ? (
    <ColumnLayout columns={1}>
      <KeyValuePairs
        columns={3}
        items={[
          { label: "Registrar", value: rdapData.registrar ?? "—" },
          { label: "Registered", value: formatDate(rdapData.registrationDate) },
          { label: "Expires", value: formatDate(rdapData.expirationDate) },
          { label: "Last changed", value: formatDate(rdapData.lastChanged) },
          {
            label: "DNSSEC",
            value:
              rdapData.dnssecSigned === null ? (
                "—"
              ) : rdapData.dnssecSigned ? (
                <StatusIndicator type="success">Signed</StatusIndicator>
              ) : (
                <StatusIndicator type="warning">Unsigned</StatusIndicator>
              ),
          },
          {
            label: "Status",
            value: rdapData.status.length > 0 ? rdapData.status.join(", ") : "—",
          },
        ]}
      />
      {rdapData.nameservers.length > 0 && (
        <KeyValuePairs
          columns={1}
          items={[
            {
              label: "Nameservers",
              value: rdapData.nameservers.join(", "),
            },
          ]}
        />
      )}
    </ColumnLayout>
  ) : null;

  const hasResults = dnsRecords !== null || rdapData !== null || dnsError !== null || rdapError !== null;

  return (
    <AppLayout
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            { text: "Home", href: "/" },
            { text: "Domain Lookup", href: "/domain-lookup" },
          ]}
        />
      }
      navigation={<SideNav activeHref="/domain-lookup" />}
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Look up DNS records and registration data for any domain."
              actions={
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLookup();
                  }}
                >
                  <SpaceBetween direction="horizontal" size="xs">
                    <div ref={inputRef} style={{ minWidth: 400 }}>
                      <Input
                        value={domainInput}
                        onChange={({ detail }) => setDomainInput(detail.value)}
                        placeholder="example.com"
                        disabled={loading}
                      />
                    </div>
                    <Button variant="primary" loading={loading} onClick={handleLookup}>
                      Lookup
                    </Button>
                  </SpaceBetween>
                </form>
              }
            >
              Domain Lookup
            </Header>
          }
        >
          <SpaceBetween size="l">
            {loading && (
              <Box textAlign="center" padding="xxl">
                <Spinner size="large" />
              </Box>
            )}

            {!loading && hasResults && (
              <>
                {(insightsItems.length > 0 || cloudFrontCname || registryMatch) && (
                  <Container header={<Header variant="h2">Insights</Header>}>
                    <SpaceBetween size="m">
                      {insightsItems.length > 0 && (
                        <KeyValuePairs columns={3} items={insightsItems} />
                      )}

                      {cloudFrontCname && (
                        <Alert type="info" header="CloudFront distribution detected">
                          This domain resolves via <Box variant="code" display="inline">{cloudFrontCname}</Box>.
                          {" "}Browse the <Link href="/datasets/cloudfront-edge-locations">CloudFront Edge Locations</Link> dataset
                          to see where this distribution is served from.
                        </Alert>
                      )}

                      {registryMatch && (
                        <Alert type="info" header={`Found in Domain Registry dataset (rank #${registryMatch.rank})`}>
                          <KeyValuePairs
                            columns={3}
                            items={[
                              { label: "Registrar (snapshot)", value: registryMatch.registrar },
                              { label: "Created (snapshot)", value: formatDate(registryMatch.created) },
                              { label: "Expires (snapshot)", value: formatDate(registryMatch.expires) },
                              { label: "Nameservers (snapshot)", value: registryMatch.nameservers },
                              {
                                label: "DNSSEC (snapshot)",
                                value: registryMatch.dnssec ? (
                                  <StatusIndicator type="success">Signed</StatusIndicator>
                                ) : (
                                  <StatusIndicator type="warning">Unsigned</StatusIndicator>
                                ),
                              },
                              {
                                label: "Full dataset",
                                value: <Link href="/datasets/domain-registry">View all</Link>,
                              },
                            ]}
                          />
                        </Alert>
                      )}
                    </SpaceBetween>
                  </Container>
                )}

                <Tabs
                  tabs={[
                    {
                      label: "DNS Records",
                      id: "dns",
                      content: (
                        <Container
                          header={
                            <Header
                              variant="h2"
                              counter={dnsRecords ? `(${dnsRecords.filter((r) => !r.collapsedData).length})` : undefined}
                              description="Queried via Cloudflare DNS-over-HTTPS"
                            >
                              {queriedDomain}
                            </Header>
                          }
                        >
                          {dnsContent}
                        </Container>
                      ),
                    },
                    {
                      label: "Registration (RDAP)",
                      id: "rdap",
                      content: (
                        <Container
                          header={
                            <Header
                              variant="h2"
                              description="Queried via rdap.org"
                            >
                              {queriedDomain}
                            </Header>
                          }
                        >
                          {rdapContent}
                        </Container>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}

export default DomainLookup;
