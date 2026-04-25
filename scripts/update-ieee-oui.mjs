import { readFileSync, writeFileSync, appendFileSync } from "fs";

const URL = "https://standards-oui.ieee.org/oui/oui.csv";
const OUTPUT = "public/static/ieee-oui.json";

const res = await fetch(URL);
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const text = await res.text();

const lines = text.split("\n").slice(1);
const records = [];

for (const line of lines) {
  if (!line.trim()) continue;
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { fields.push(current); current = ""; continue; }
    current += ch;
  }
  fields.push(current);

  const [, prefix, vendor, address] = fields;
  if (prefix) records.push({ prefix, vendor: (vendor ?? "").replace(/\r/g, ""), address: (address ?? "").replace(/\r/g, "") });
}

records.sort((a, b) => a.prefix.localeCompare(b.prefix));

const json = JSON.stringify(records, null, 2) + "\n";

let existing = "";
try { existing = readFileSync(OUTPUT, "utf8"); } catch {}

if (json === existing) {
  console.log(`No changes (${records.length} entries)`);
  process.exit(2);
}

writeFileSync(OUTPUT, json);
const title = `Update IEEE OUI vendor data (${records.length} entries)`;
console.log(title);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`);
}
