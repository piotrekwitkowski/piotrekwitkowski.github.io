#!/usr/bin/env node

/**
 * Generates airport-coordinates.json by matching IATA codes from the
 * CloudFront edge locations dataset against the OurAirports public dataset.
 *
 * Data source: https://ourairports.com/data/airports.csv (public domain)
 *
 * Exit codes:
 *   0 — file written successfully
 *   1 — error
 *   2 — no changes
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDGE_LOCATIONS_PATH = resolve(__dirname, "..", "public", "static", "cloudfront-edge-locations.json");
const OUTPUT_PATH = resolve(__dirname, "..", "public", "static", "airport-coordinates.json");

const OURAIRPORTS_URL = "https://ourairports.com/data/airports.csv";

/**
 * Parse a CSV line handling quoted fields.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

async function main() {
  // 1. Load edge locations to get IATA codes
  const edgeData = JSON.parse(await readFile(EDGE_LOCATIONS_PATH, "utf-8"));
  const iataCodes = new Set(edgeData.map((loc) => loc.iata));
  console.log(`Looking up coordinates for ${iataCodes.size} IATA codes`);

  // 2. Fetch OurAirports data
  console.log(`Fetching ${OURAIRPORTS_URL}…`);
  const res = await fetch(OURAIRPORTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  const csv = await res.text();

  // 3. Parse CSV and build IATA → coordinates map
  const lines = csv.split("\n");
  const headers = parseCSVLine(lines[0]);
  const iataIdx = headers.indexOf("iata_code");
  const latIdx = headers.indexOf("latitude_deg");
  const lonIdx = headers.indexOf("longitude_deg");
  const nameIdx = headers.indexOf("name");
  const typeIdx = headers.indexOf("type");

  if (iataIdx === -1 || latIdx === -1 || lonIdx === -1) {
    throw new Error(`Missing expected CSV columns. Found: ${headers.join(", ")}`);
  }

  // Prefer large_airport > medium_airport > others
  const TYPE_PRIORITY = { "large_airport": 3, "medium_airport": 2 };
  const found = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCSVLine(line);
    const iata = fields[iataIdx];
    if (!iata || !iataCodes.has(iata)) continue;

    const type = fields[typeIdx] ?? "";
    const priority = TYPE_PRIORITY[type] ?? 1;
    const existing = found.get(iata);

    if (!existing || priority > existing._priority) {
      found.set(iata, {
        iata: iata,
        name: fields[nameIdx] ?? "",
        latitude: parseFloat(fields[latIdx]),
        longitude: parseFloat(fields[lonIdx]),
        _priority: priority,
      });
    }
  }

  // 4. Manual fallbacks for codes missing from OurAirports
  const FALLBACKS = {
    "TXL": { iata: "TXL", name: "Berlin Tegel Airport", latitude: 52.5597, longitude: 13.2877 },
    "YTO": { iata: "YTO", name: "Toronto (metropolitan area)", latitude: 43.6777, longitude: -79.6248 },
  };

  // 5. Build output array
  const results = [];
  const missing = [];
  for (const code of [...iataCodes].sort()) {
    const entry = found.get(code);
    if (entry) {
      const { _priority, ...clean } = entry;
      results.push(clean);
    } else if (FALLBACKS[code]) {
      results.push(FALLBACKS[code]);
    } else {
      missing.push(code);
    }
  }

  console.log(`Matched ${results.length}/${iataCodes.size} airports`);
  if (missing.length) {
    console.warn(`⚠ No coordinates found for: ${missing.join(", ")}`);
  }

  // 5. Compare with existing file
  if (existsSync(OUTPUT_PATH)) {
    const existing = await readFile(OUTPUT_PATH, "utf-8");
    const fresh = JSON.stringify(results, null, 2) + "\n";
    if (existing === fresh) {
      console.log("No changes detected.");
      process.exit(2);
    }
  }

  // 6. Write output
  await writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2) + "\n", "utf-8");
  console.log(`Written ${OUTPUT_PATH}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
