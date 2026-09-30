/**
 * Pulls the food log from the published Google Sheet into src/content/food.generated.json.
 *
 *   npm run food:sync                         # FOOD_SHEET_CSV_URL from env, .env.local or .env
 *   npm run food:sync -- --file sheet.csv     # a local export instead
 *
 * Google Maps links in the coords (or maps) column are resolved to a pin and suburb, and
 * cached in src/content/maps-links.generated.json.
 *
 * Bad rows are skipped with a warning. If the sheet can't be fetched, isn't CSV, or has no
 * valid rows, nothing is written and it exits non-zero — the committed JSON stays the last
 * good copy, so a broken sheet can never break the site.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

import { loadEnvLocal } from "./lib/env.mjs";
import { loadTs } from "./lib/load-ts.mjs";
import { resolveMapsLinks } from "./lib/maps-links.mjs";

const OUT = "src/content/food.generated.json";

function fail(message) {
  console.error(`food:sync failed: ${message}`);
  console.error(`${OUT} left unchanged.`);
  process.exit(1);
}

async function readSheet() {
  const fileFlag = process.argv.indexOf("--file");
  if (fileFlag !== -1) return readFileSync(process.argv[fileFlag + 1], "utf8");

  loadEnvLocal();
  const url = process.env.FOOD_SHEET_CSV_URL;
  if (!url) fail("FOOD_SHEET_CSV_URL is not set (see docs/food.md)");

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  } catch (e) {
    fail(`could not reach the sheet (${e.message})`);
  }
  if (!res.ok) fail(`sheet responded ${res.status}`);
  const text = await res.text();
  // An unpublished or private sheet answers with a Google sign-in page, not CSV.
  if (/^\s*</.test(text)) fail("the sheet returned HTML, not CSV — is it published to the web as CSV?");
  return text;
}

const sheet = await loadTs("src/lib/food-sheet.ts");
const csv = await readSheet();

// Maps links are looked up once and cached; a lookup that fails only costs that spot its pin.
const maps = await resolveMapsLinks(sheet.collectMapsLinks(csv), sheet);

let result;
try {
  result = sheet.parseSheet(csv, maps.places);
} catch (e) {
  fail(e.message);
}
const { restaurants } = result;
const warnings = [...maps.warnings, ...result.warnings];

for (const w of warnings) console.warn(`warning: ${w}`);
if (!restaurants.length) fail("no valid rows");

const json = `${JSON.stringify(restaurants, null, 2)}\n`;
let previous = "";
try {
  previous = readFileSync(OUT, "utf8");
} catch {}

if (json === previous) {
  console.log(`food:sync: ${restaurants.length} restaurants, no changes.`);
} else {
  writeFileSync(OUT, json);
  console.log(`food:sync: wrote ${restaurants.length} restaurants to ${OUT}.`);
}

// Shows skipped rows on the GitHub Actions run page.
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [`### Food sync`, `${restaurants.length} restaurants.`, ""];
  if (warnings.length) lines.push("**Skipped or ignored:**", ...warnings.map((w) => `- ${w}`));
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}
