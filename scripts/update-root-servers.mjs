import { readFileSync, writeFileSync, appendFileSync } from "fs";

const LETTERS = "abcdefghijklm".split("");
const OUTPUT = "public/static/root-servers.json";

const records = [];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

for (const letter of LETTERS) {
  const url = `https://root-servers.org/root/${letter}/json/`;
  console.log(`  Fetching ${letter.toUpperCase()}-root...`);

  let data;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (res.ok) { data = await res.json(); break; }
    if (res.status === 429) {
      const wait = 2000 * (attempt + 1);
      console.log(`    Rate limited, waiting ${wait}ms...`);
      await sleep(wait);
    } else {
      console.log(`    Failed: ${res.status}`);
      break;
    }
  }
  if (!data) continue;

  const operator = data.Operator ?? "";
  const rootServer = `${letter.toUpperCase()}-root`;

  for (const site of data.Sites ?? []) {
    records.push({
      root: rootServer,
      operator,
      country: site.Country ?? "",
      town: site.Town ?? "",
      type: site.Type ?? "",
      instances: site.Instances ?? 1,
      ipv4: site.IPv4 ?? false,
      ipv6: site.IPv6 ?? false,
      latitude: site.Latitude ?? null,
      longitude: site.Longitude ?? null,
    });
  }
}

records.sort((a, b) => a.root.localeCompare(b.root) || a.country.localeCompare(b.country) || a.town.localeCompare(b.town));

const json = JSON.stringify(records, null, 2) + "\n";

let existing = "";
try { existing = readFileSync(OUTPUT, "utf8"); } catch {}

if (json === existing) {
  console.log(`No changes (${records.length} sites)`);
  process.exit(2);
}

writeFileSync(OUTPUT, json);
const title = `Update root DNS server locations (${records.length} sites)`;
console.log(title);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`);
}
