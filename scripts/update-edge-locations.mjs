#!/usr/bin/env node

/**
 * Fetches CloudFront edge location data from public sources,
 * compares against the committed version, and outputs a diff summary.
 *
 * Exit codes:
 *   0 — changes detected, updated file written
 *   1 — error
 *   2 — no changes
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "..", "public", "static", "cloudfront-edge-locations.json");

const CLOUDPING_URL = "https://static.cloudping.cloud/cdn/cloudfront-edge-locations.json";
const AWS_IP_RANGES_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json";

// ── Fetch helpers ──────────────────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Country name → ISO 3166-1 alpha-2 code mapping.
 * Covers all countries currently present in the cloudping.cloud dataset.
 */
const COUNTRY_CODES = {
  "Argentina": "AR",
  "Australia": "AU",
  "Austria": "AT",
  "Bahrain": "BH",
  "Belgium": "BE",
  "Brazil": "BR",
  "Bulgaria": "BG",
  "Canada": "CA",
  "Chile": "CL",
  "China": "CN",
  "Colombia": "CO",
  "Croatia": "HR",
  "Czech Republic": "CZ",
  "Denmark": "DK",
  "Egypt": "EG",
  "Finland": "FI",
  "France": "FR",
  "Germany": "DE",
  "Greece": "GR",
  "Hungary": "HU",
  "India": "IN",
  "Indonesia": "ID",
  "Ireland": "IE",
  "Israel": "IL",
  "Italy": "IT",
  "Japan": "JP",
  "Kenya": "KE",
  "Malaysia": "MY",
  "Mexico": "MX",
  "Netherlands": "NL",
  "New Zealand": "NZ",
  "Nigeria": "NG",
  "Norway": "NO",
  "Oman": "OM",
  "Peru": "PE",
  "Philippines": "PH",
  "Poland": "PL",
  "Portugal": "PT",
  "Qatar": "QA",
  "Romania": "RO",
  "Saudi Arabia": "SA",
  "Singapore": "SG",
  "South Africa": "ZA",
  "South Korea": "KR",
  "Spain": "ES",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Thailand": "TH",
  "Turkey": "TR",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  "Vietnam": "VN",
};

const LOCATION_OVERRIDES = {
  "HKG": { country: "Hong Kong", country_code: "HK", city: "Hong Kong" },
  "TPE": { country: "Taiwan", country_code: "TW", city: "Taipei" },
};

/**
 * Normalise the cloudping.cloud payload into a sorted array keyed by iata_code.
 * The upstream format is { edge_locations: [ { iata_code, country, city, airport, active_nodes: [{ code }] } ] }.
 * We flatten active_nodes to string codes, resolve country_code from our mapping, and sort for stable diffs.
 */
function normaliseCloudping(raw) {
  const locations = raw.edge_locations ?? [];
  const unmapped = new Set();
  const entries = locations.map((loc) => {
    const iata = loc.iata_code;
    const override = LOCATION_OVERRIDES[iata];
    const country = override?.country ?? loc.country ?? "";
    const code = override?.country_code ?? COUNTRY_CODES[country];
    if (country && !code) unmapped.add(country);
    let city = override?.city ?? loc.city ?? "";
    if (code === "US" || code === "CA") {
      city = city.replace(/,\s*[A-Z]{2}$/, "");
    }
    return {
      iata: loc.iata_code,
      city,
      country,
      country_code: code ?? "",
      nodes: (loc.active_nodes ?? []).map((n) => (typeof n === "string" ? n : n.code)).sort(),
    };
  });
  if (unmapped.size) {
    console.warn(`⚠ Unmapped countries (add to COUNTRY_CODES): ${[...unmapped].sort().join(", ")}`);
  }
  return entries.sort((a, b) => a.iata.localeCompare(b.iata));
}

/**
 * Extract unique CloudFront edge location codes from the AWS ip-ranges.json.
 *
 * NOTE: As of 2025, CLOUDFRONT entries in ip-ranges.json only expose
 * { ip_prefix, region: "GLOBAL", service, network_border_group: "GLOBAL" }.
 * There is no per-POP `edge_location` field. We extract any non-"GLOBAL"
 * network_border_group values as a best-effort proxy, and also check for an
 * `edge_location` field in case AWS adds it in the future.
 */
function extractAwsEdgeCodes(ipRanges) {
  const codes = new Set();
  for (const prefix of [...(ipRanges.prefixes ?? []), ...(ipRanges.ipv6_prefixes ?? [])]) {
    if (prefix.service !== "CLOUDFRONT") continue;

    // Prefer edge_location if it exists (future-proofing)
    if (prefix.edge_location) {
      const code = prefix.edge_location.replace(/\d+$/, "");
      codes.add(code);
      continue;
    }

    // Fall back to network_border_group if it looks like an IATA code
    // (3 uppercase letters). Region names like "us-east-1" are not edge codes.
    const nbg = prefix.network_border_group;
    if (nbg && /^[A-Z]{3}$/.test(nbg)) {
      codes.add(nbg);
    }
  }
  return codes;
}

// ── Diff logic ─────────────────────────────────────────────────────────────

function buildIndex(locations) {
  const map = new Map();
  for (const loc of locations) map.set(loc.iata, loc);
  return map;
}

function diffLocations(oldLocs, newLocs) {
  const oldMap = buildIndex(oldLocs);
  const newMap = buildIndex(newLocs);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [code, loc] of newMap) {
    if (!oldMap.has(code)) {
      added.push(loc);
    } else {
      const old = oldMap.get(code);
      const diff = diffSingleLocation(old, loc);
      if (diff) changed.push({ iata: code, ...diff });
    }
  }

  for (const [code, loc] of oldMap) {
    if (!newMap.has(code)) removed.push(loc);
  }

  return { added, removed, changed };
}

function diffSingleLocation(old, cur) {
  const diffs = {};
  let hasDiff = false;

  for (const key of ["city", "country", "country_code"]) {
    if (old[key] !== cur[key]) {
      diffs[key] = { from: old[key], to: cur[key] };
      hasDiff = true;
    }
  }

  const oldNodes = new Set(old.nodes);
  const newNodes = new Set(cur.nodes);
  const nodesAdded = cur.nodes.filter((n) => !oldNodes.has(n));
  const nodesRemoved = old.nodes.filter((n) => !newNodes.has(n));

  if (nodesAdded.length || nodesRemoved.length) {
    diffs.nodes_added = nodesAdded;
    diffs.nodes_removed = nodesRemoved;
    hasDiff = true;
  }

  return hasDiff ? diffs : null;
}

// ── Summary formatting ─────────────────────────────────────────────────────

function formatSummary(diff, warnings) {
  const lines = [];

  if (diff.added.length) {
    lines.push("### New locations\n");
    for (const loc of diff.added) {
      lines.push(`- **${loc.iata}** — ${loc.city}, ${loc.country} (${loc.nodes.length} node(s))`);
    }
    lines.push("");
  }

  if (diff.removed.length) {
    lines.push("### Removed locations\n");
    for (const loc of diff.removed) {
      lines.push(`- **${loc.iata}** — ${loc.city}, ${loc.country}`);
    }
    lines.push("");
  }

  if (diff.changed.length) {
    lines.push("### Changed locations\n");
    for (const ch of diff.changed) {
      const parts = [];
      for (const key of ["city", "country", "country_code"]) {
        if (ch[key]) parts.push(`${key}: \`${ch[key].from}\` → \`${ch[key].to}\``);
      }
      if (ch.nodes_added?.length) parts.push(`nodes added: ${ch.nodes_added.join(", ")}`);
      if (ch.nodes_removed?.length) parts.push(`nodes removed: ${ch.nodes_removed.join(", ")}`);
      lines.push(`- **${ch.iata}**: ${parts.join("; ")}`);
    }
    lines.push("");
  }

  if (warnings.length) {
    lines.push("### ⚠️ Cross-reference warnings\n");
    lines.push("The following edge location codes appear in AWS ip-ranges.json (CLOUDFRONT service)");
    lines.push("but are **not present** in the cloudping.cloud dataset:\n");
    for (const code of warnings.sort()) {
      lines.push(`- \`${code}\``);
    }
    lines.push("");
  }

  if (!lines.length) return "";
  return lines.join("\n");
}

function shortTitle(diff) {
  const parts = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.changed.length) parts.push(`${diff.changed.length} changed`);
  return `Update CloudFront edge locations (${parts.join(", ")})`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // 1. Fetch both sources in parallel
  console.log("Fetching cloudping.cloud edge locations…");
  console.log("Fetching AWS ip-ranges.json…");
  const [cloudpingRaw, awsRanges] = await Promise.all([
    fetchJSON(CLOUDPING_URL),
    fetchJSON(AWS_IP_RANGES_URL),
  ]);

  // 2. Normalise primary source
  const freshLocations = normaliseCloudping(cloudpingRaw);
  console.log(`Fetched ${freshLocations.length} locations from cloudping.cloud`);

  // 3. Extract AWS edge codes for cross-reference
  const awsCodes = extractAwsEdgeCodes(awsRanges);
  console.log(`Found ${awsCodes.size} unique CloudFront edge codes in AWS ip-ranges`);

  // 4. Cross-reference: find codes in AWS but missing from cloudping
  const cloudpingCodes = new Set(freshLocations.map((l) => l.iata));
  const missingFromCloudping = [...awsCodes].filter((code) => !cloudpingCodes.has(code));

  if (missingFromCloudping.length) {
    console.warn(`⚠ ${missingFromCloudping.length} AWS edge code(s) missing from cloudping: ${missingFromCloudping.join(", ")}`);
  }

  // 5. Load committed data (or treat as empty on first run)
  let committedLocations = [];
  if (existsSync(DATA_PATH)) {
    const raw = await readFile(DATA_PATH, "utf-8");
    committedLocations = JSON.parse(raw);
  } else {
    console.log("No existing data file — treating as initial seed.");
  }

  // 6. Diff
  const diff = diffLocations(committedLocations, freshLocations);
  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;

  if (totalChanges === 0 && missingFromCloudping.length === 0) {
    console.log("No changes detected.");
    process.exit(2);
  }

  if (totalChanges === 0 && missingFromCloudping.length > 0) {
    // Only cross-ref warnings, no actual data changes — don't update file
    console.log("No data changes, but cross-reference warnings exist.");
    const summary = formatSummary(diff, missingFromCloudping);
    await outputForGitHub("summary", summary);
    await outputForGitHub("title", "CloudFront edge locations: cross-reference warnings only");
    // Still exit 2 — no file changes to commit
    process.exit(2);
  }

  console.log(`Changes: +${diff.added.length} added, -${diff.removed.length} removed, ~${diff.changed.length} changed`);

  // 7. Write updated data
  await writeFile(DATA_PATH, JSON.stringify(freshLocations, null, 2) + "\n", "utf-8");
  console.log(`Updated ${DATA_PATH}`);

  // 8. Output summary for the workflow
  const title = shortTitle(diff);
  const summary = formatSummary(diff, missingFromCloudping);

  await outputForGitHub("title", title);
  await outputForGitHub("summary", summary);

  console.log("\n" + summary);
  process.exit(0);
}

/**
 * Write a value to $GITHUB_OUTPUT (or fall back to stdout for local runs).
 * Multiline values use the heredoc delimiter syntax.
 */
async function outputForGitHub(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    console.log(`[output] ${name}=${value.substring(0, 200)}…`);
    return;
  }

  if (value.includes("\n")) {
    const delimiter = "EOF_" + Math.random().toString(36).slice(2, 10);
    const content = `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
    await writeFile(outputFile, content, { flag: "a" });
  } else {
    await writeFile(outputFile, `${name}=${value}\n`, { flag: "a" });
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
