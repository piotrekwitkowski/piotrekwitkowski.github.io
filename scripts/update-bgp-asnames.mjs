import { readFileSync, writeFileSync, appendFileSync } from "fs";

const URL = "https://ftp.ripe.net/ripe/asnames/asn.txt";
const OUTPUT = "public/static/bgp-asnames.json";

const res = await fetch(URL);
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const text = await res.text();

const records = [];

for (const line of text.split("\n")) {
  if (!line.trim()) continue;
  const spaceIdx = line.indexOf(" ");
  if (spaceIdx === -1) continue;

  const asn = parseInt(line.slice(0, spaceIdx));
  if (isNaN(asn)) continue;

  const rest = line.slice(spaceIdx + 1);
  const lastComma = rest.lastIndexOf(", ");
  if (lastComma === -1) {
    records.push({ asn, name: rest.trim(), country: "" });
  } else {
    records.push({
      asn,
      name: rest.slice(0, lastComma).trim(),
      country: rest.slice(lastComma + 2).trim(),
    });
  }
}

const json = JSON.stringify(records, null, 2) + "\n";

let existing = "";
try { existing = readFileSync(OUTPUT, "utf8"); } catch {}

if (json === existing) {
  console.log(`No changes (${records.length} entries)`);
  process.exit(2);
}

writeFileSync(OUTPUT, json);
const title = `Update BGP AS names (${records.length} entries)`;
console.log(title);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`);
}
