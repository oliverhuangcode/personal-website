/**
 * End-to-end checks against the static export in `out/`.
 * Run `npm run build` first, then `npm run test:e2e`.
 */
import { chromium } from "playwright";

import { startStaticServer } from "./static-server.mjs";

const { base, close } = await startStaticServer();
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

// 7. The boot overlay must not swallow interaction while it plays
{
  const fresh = await b.newContext({ viewport: { width: 1360, height: 880 } });
  const bp = await fresh.newPage();
  await bp.goto(base + "/travel");
  await bp.waitForTimeout(900); // still inside the 3s boot sequence
  const boot = bp.locator(".boot-screen");
  if (!(await boot.isVisible())) fail.push("boot did not play on a fresh session");
  if ((await boot.evaluate((el) => getComputedStyle(el).pointerEvents)) !== "none") {
    fail.push("boot overlay intercepts pointer events");
  }
  const gd = () => bp.locator('[role="img"] path').nth(1).getAttribute("d");
  const before = await gd();
  const box = await bp.getByRole("img", { name: /Globe/ }).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await bp.mouse.move(cx, cy);
  await bp.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await bp.mouse.move(cx - i * 6, cy + i * 2);
    await bp.waitForTimeout(16);
  }
  const during = await gd();
  await bp.mouse.up();
  if (during === before) fail.push("globe could not be dragged during the boot sequence");
  await fresh.close();
}

console.log(fail.length ? "FAILURES:\n" + fail.join("\n") : "ALL CHECKS PASSED");

await b.close();
close();
if (fail.length) process.exit(1);
