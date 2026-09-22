/**
 * axe-core accessibility scan of every page in the static export.
 * Run `npm run build` first, then `npm run test:a11y`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { chromium } from "playwright";

import { startStaticServer } from "./static-server.mjs";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core"), "utf8");
const { base, close } = await startStaticServer();
const browser = await chromium.launch();
let violations = 0;

for (const path of ["/", "/about", "/projects", "/travel", "/food"]) {
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 880 } })).newPage();
  await page.goto(base + path);
  // Let the boot overlay finish so the page underneath is what gets scanned.
  await page.waitForTimeout(3400);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(() => axe.run(document, { resultTypes: ["violations"] }));
  console.log("==", path, result.violations.length ? "" : "clean");
  for (const v of result.violations) {
    violations++;
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}) -> ${v.nodes[0].target}`);
  }
}

await browser.close();
close();
if (violations) process.exit(1);
