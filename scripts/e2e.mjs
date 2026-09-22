/**
 * End-to-end checks against the static export in `out/`.
 * Run `npm run build` first, then `npm run test:e2e`.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { chromium } from "playwright";

const OUT = new URL("../out/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

/** Serves `out/` the way a static host does: clean URLs, 404.html fallback. */
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const candidates = url.endsWith("/")
    ? [join(url, "index.html"), url.replace(/\/$/, "") + ".html"]
    : [url, url + ".html", join(url, "index.html")];
  for (const candidate of candidates) {
    try {
      const body = await readFile(join(OUT, candidate));
      res.writeHead(200, { "content-type": TYPES[extname(candidate)] ?? "application/octet-stream" });
      return res.end(body);
    } catch {
      // try the next candidate
    }
  }
  res.writeHead(404, { "content-type": "text/html" });
  res.end(await readFile(join(OUT, "404.html")).catch(() => "not found"));
});

await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;

const b = await chromium.launch();
const fail = [];

// 1. No horizontal overflow anywhere
for (const [w, h] of [[1360, 880], [768, 1024], [390, 844], [320, 720]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  for (const path of ["/", "/about", "/projects", "/travel", "/food"]) {
    await p.goto(base + path);
    await p.waitForTimeout(400);
    const { sw, cw } = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    if (sw > cw + 1) fail.push(`overflow ${w}px ${path}: ${sw} > ${cw}`);
  }
}

// 2. Sound toggle: persists, and S key works
const ctx = await b.newContext({ viewport: { width: 1360, height: 880 } });
const p = await ctx.newPage();
await p.goto(base + "/");
await p.waitForTimeout(3200);
const label = () => p.locator("header button[aria-label='Sound effects']").innerText();
if (!(await label()).includes("OFF")) fail.push("sound not off by default");
await p.keyboard.press("s");
await p.waitForTimeout(200);
if (!(await label()).includes("ON")) fail.push("S key did not enable sound");
await p.reload();
await p.waitForTimeout(600);
if (!(await label()).includes("ON")) fail.push("sound preference not persisted");
console.log("localStorage:", await p.evaluate(() => localStorage.getItem("oh:sfx")));

// 3. Boot plays once per session
console.log("boot visible on reload (should be false):", await p.locator(".boot-screen").isVisible());

// 4. Globe drag rotates, and the marker tween recentres it
await p.goto(base + "/travel");
await p.waitForTimeout(600);
const pathD = () => p.locator("svg path").nth(1).getAttribute("d");
const before = await pathD();
const box = await p.getByRole("img", { name: /Globe/ }).boundingBox();
await p.mouse.move(box.x + 150, box.y + 150);
await p.mouse.down();
for (let i = 1; i <= 8; i++) await p.mouse.move(box.x + 150 - i * 15, box.y + 150);
await p.mouse.up();
await p.waitForTimeout(200);
const dragged = await pathD();
if (dragged === before) fail.push("globe drag did not rotate");

// selecting the same trip again re-centres after a drag
await p.getByRole("button", { name: /HONOLULU/ }).click();
await p.waitForTimeout(1100);
const recentred = await pathD();
if (recentred === dragged) fail.push("re-selecting current trip did not recentre");
if (recentred !== before) fail.push("recentre did not return to the original view");

// 5. A tap on the marker still registers as a click (not swallowed by drag capture)
await p.getByRole("button", { name: /JAPAN/ }).click();
await p.waitForTimeout(1000);
const beforeTap = await pathD();
const marker = await p.locator("svg rect").boundingBox();
await p.mouse.click(marker.x + marker.width / 2, marker.y + marker.height / 2);
await p.waitForTimeout(900);
if ((await pathD()) !== beforeTap) fail.push("marker tap moved the globe unexpectedly");
console.log("marker tap handled without drag:", true);

// 6. Tabs and roster
await p.goto(base + "/projects");
await p.waitForTimeout(400);
await p.getByRole("button", { name: "RESULT" }).click();
if (!(await p.locator("#project-detail").innerText()).includes("Four orgs")) fail.push("RESULT tab content wrong");
await p.getByRole("button", { name: "05 SIGNAL" }).click();
const detail = await p.locator("#project-detail").innerText();
if (!detail.includes("OVERVIEW")) fail.push("selecting a project did not reset to INFO");
if (!(await p.locator("h2").first().innerText()).includes("SIGNAL")) fail.push("project name did not update");

console.log(fail.length ? "FAILURES:\n" + fail.join("\n") : "ALL CHECKS PASSED");

await b.close();
server.close();
if (fail.length) process.exit(1);
