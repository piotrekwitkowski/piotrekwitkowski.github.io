import { readFileSync, writeFileSync, appendFileSync } from "fs";

const URL = "https://publicsuffix.org/list/public_suffix_list.dat";
const OUTPUT = "public/static/public-suffix-list.json";

const res = await fetch(URL);
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const text = await res.text();

let section = "unknown";
const records = [];

for (const line of text.split("\n")) {
  if (line.includes("===BEGIN ICANN DOMAINS===")) { section = "ICANN"; continue; }
  if (line.includes("===END ICANN DOMAINS===")) { section = "unknown"; continue; }
  if (line.includes("===BEGIN PRIVATE DOMAINS===")) { section = "private"; continue; }
  if (line.includes("===END PRIVATE DOMAINS===")) { section = "unknown"; continue; }
  if (line.startsWith("//") || !line.trim()) continue;

  const suffix = line.trim();
  const wildcard = suffix.startsWith("*.");
  const exception = suffix.startsWith("!");

  records.push({
    suffix: exception ? suffix.slice(1) : suffix,
    type: section,
    wildcard,
    exception,
  });
}

const json = JSON.stringify(records, null, 2) + "\n";

let existing = "";
try { existing = readFileSync(OUTPUT, "utf8"); } catch {}

if (json === existing) {
  console.log(`No changes (${records.length} entries)`);
  process.exit(2);
}

writeFileSync(OUTPUT, json);
const title = `Update Public Suffix List (${records.length} entries)`;
console.log(title);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`);
}
