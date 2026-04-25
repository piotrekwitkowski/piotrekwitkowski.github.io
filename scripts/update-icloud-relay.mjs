import { readFileSync, writeFileSync, appendFileSync } from "fs";

const BASE_URL =
  "https://raw.githubusercontent.com/piotrekwitkowski/icloud-relay-ipsets/main";
const OUTPUT = "public/static/icloud-private-relay.txt";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.text()).trim();
}

const [ipv4, ipv6] = await Promise.all([
  fetchText(`${BASE_URL}/ipv4.txt`),
  fetchText(`${BASE_URL}/ipv6.txt`),
]);

const text = ipv4 + "\n" + ipv6 + "\n";
const count = text.trim().split("\n").length;

let existing = "";
try {
  existing = readFileSync(OUTPUT, "utf8");
} catch {}

if (text === existing) {
  console.log(`No changes (${count} prefixes)`);
  process.exit(2);
}

writeFileSync(OUTPUT, text);
const title = `Update iCloud Private Relay IP sets (${count} prefixes)`;
console.log(title);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`);
}
