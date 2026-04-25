import { readFileSync, writeFileSync, appendFileSync } from "fs";

const TRANCO_URL = "https://tranco-list.eu/top-1m.csv.zip";
const RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const OUTPUT = "public/static/domain-registry.json";
const LIMIT = 1000;
const CONCURRENCY = 5;
const DELAY_MS = 200;

async function fetchTrancoTop(n) {
  const { execSync } = await import("child_process");
  const { mkdtempSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");

  const tmp = mkdtempSync(join(tmpdir(), "tranco-"));
  const zip = join(tmp, "top-1m.csv.zip");

  execSync(`curl -sL -o "${zip}" "${TRANCO_URL}"`);
  const csv = execSync(`unzip -p "${zip}" top-1m.csv`, { maxBuffer: 50 * 1024 * 1024 }).toString();
  execSync(`rm -rf "${tmp}"`);

  const domains = [];
  for (const line of csv.split("\n")) {
    if (domains.length >= n) break;
    const [, domain] = line.split(",");
    if (domain) domains.push(domain.trim());
  }
  return domains;
}

async function loadBootstrap() {
  const res = await fetch(RDAP_BOOTSTRAP_URL);
  if (!res.ok) throw new Error(`Bootstrap fetch failed: ${res.status}`);
  const data = await res.json();
  const map = {};
  for (const [tlds, urls] of data.services) {
    for (const tld of tlds) {
      map[tld.toLowerCase()] = urls[0];
    }
  }
  return map;
}

function getTld(domain) {
  const parts = domain.split(".");
  return parts[parts.length - 1].toLowerCase();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryRdap(domain, baseUrl) {
  const url = `${baseUrl}domain/${domain}`;
  const res = await fetch(url, {
    headers: { Accept: "application/rdap+json" },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null;
  if (res.status === 429) throw new Error("rate-limited");
  if (!res.ok) return null;
  return res.json();
}

function extractRecord(domain, rdap) {
  if (!rdap) return null;

  const events = rdap.events ?? [];
  const created = events.find((e) => e.eventAction === "registration")?.eventDate?.split("T")[0] ?? null;
  const expires = events.find((e) => e.eventAction === "expiration")?.eventDate?.split("T")[0] ?? null;

  let registrar = null;
  for (const entity of rdap.entities ?? []) {
    if (entity.roles?.includes("registrar")) {
      const vcard = entity.vcardArray?.[1];
      if (vcard) {
        const fn = vcard.find((v) => v[0] === "fn");
        if (fn) registrar = fn[3];
      }
      break;
    }
  }

  const nameservers = (rdap.nameservers ?? []).map((ns) => ns.ldhName?.toLowerCase()).filter(Boolean);
  const dnssec = rdap.secureDNS?.delegationSigned ?? false;

  return { rank: 0, domain, registrar, created, expires, nameservers: nameservers.join(", "), dnssec };
}

async function crawl(domains, bootstrap) {
  const results = [];
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= domains.length) return;

      const domain = domains[idx];
      const tld = getTld(domain);
      const baseUrl = bootstrap[tld];

      if (!baseUrl) {
        if ((idx + 1) % 100 === 0) console.log(`  ${idx + 1}/${domains.length}`);
        continue;
      }

      let retries = 3;
      while (retries > 0) {
        try {
          const rdap = await queryRdap(domain, baseUrl);
          const record = extractRecord(domain, rdap);
          if (record) {
            record.rank = idx + 1;
            results.push(record);
          }
          break;
        } catch (err) {
          if (err.message === "rate-limited") {
            console.log(`  Rate limited on ${domain}, backing off...`);
            await sleep(5000);
            retries--;
          } else {
            break;
          }
        }
      }

      await sleep(DELAY_MS);
      if ((idx + 1) % 100 === 0) console.log(`  ${idx + 1}/${domains.length}`);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  results.sort((a, b) => a.rank - b.rank);
  return results;
}

console.log(`Fetching Tranco top ${LIMIT}...`);
const domains = await fetchTrancoTop(LIMIT);
console.log(`Got ${domains.length} domains`);

console.log("Loading RDAP bootstrap...");
const bootstrap = await loadBootstrap();
console.log(`Loaded ${Object.keys(bootstrap).length} TLD mappings`);

console.log("Crawling RDAP...");
const records = await crawl(domains, bootstrap);
console.log(`Got ${records.length} records`);

const json = JSON.stringify(records, null, 2) + "\n";

let existing = "";
try {
  existing = readFileSync(OUTPUT, "utf8");
} catch {}

if (json === existing) {
  console.log("No changes");
  process.exit(2);
}

writeFileSync(OUTPUT, json);
const title = `Update domain registry data (${records.length} domains)`;
console.log(title);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`);
}
