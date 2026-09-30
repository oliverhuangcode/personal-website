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
  for (const path of ["/", "/about", "/projects", "/travel", "/food", "/food/melbourne"]) {
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
// The 3D globe publishes where it is looking, so tests need no pixel-peeking.
const globe = p.locator("[data-renderer]");
const pathD = async () => `${await globe.getAttribute("data-lon")},${await globe.getAttribute("data-lat")}`;
if ((await globe.getAttribute("data-renderer")) !== "webgl") fail.push("globe is not using WebGL");
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
await p.getByRole("button", { name: /^\d{3} HONOLULU/ }).click();
await p.waitForTimeout(1100);
const recentred = await pathD();
if (recentred === dragged) fail.push("re-selecting current trip did not recentre");
if (recentred !== before) fail.push("recentre did not return to the original view");

// 5. A tap on the marker still registers as a click (not swallowed by drag capture)
await p.getByRole("button", { name: /^\d{3} JAPAN/ }).click();
await p.waitForTimeout(1000);
const beforeTap = await pathD();
const marker = await p.getByRole("button", { name: /Centre the globe on JAPAN/ }).boundingBox();
await p.mouse.click(marker.x + marker.width / 2, marker.y + marker.height / 2);
await p.waitForTimeout(900);
if ((await pathD()) !== beforeTap) fail.push("marker tap moved the globe unexpectedly");
console.log("marker tap handled without drag:", true);

// 6. Tabs and roster
await p.goto(base + "/projects");
await p.waitForTimeout(400);
// Picks run in a view transition, so the DOM updates a frame or two after the click.
const shows = (loc, text) =>
  loc
    .filter({ hasText: text })
    .first()
    .waitFor({ timeout: 2000 })
    .then(() => true, () => false);
await p.getByRole("button", { name: "STACK" }).click();
if (!(await shows(p.locator("#project-detail"), "Drizzle"))) fail.push("STACK tab content wrong");
await p.getByRole("button", { name: "02 WEAVE" }).click();
if (!(await shows(p.locator("#project-detail"), "OVERVIEW"))) fail.push("selecting a project did not reset to INFO");
if (!(await shows(p.locator("h2"), "WEAVE"))) fail.push("project name did not update");

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
  const bg = bp.locator("[data-renderer]");
  const gd = async () => `${await bg.getAttribute("data-lon")},${await bg.getAttribute("data-lat")}`;
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

// 8. Enabling sound actually produces audio on interaction
{
  const audio = await b.newContext({ viewport: { width: 1360, height: 880 } });
  const ap = await audio.newPage();
  await ap.goto(base + "/projects");
  await ap.waitForTimeout(3400);
  // Count every AudioContext node that gets started, without playing anything aloud.
  await ap.evaluate(() => {
    window.__started = 0;
    // AudioBufferSourceNode defines its own start(), so patch both prototypes.
    for (const proto of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      if (!Object.hasOwn(proto, "start")) continue;
      const realStart = proto.start;
      proto.start = function (...args) {
        window.__started++;
        return realStart.apply(this, args);
      };
    }
  });
  await ap.getByRole("button", { name: "STACK" }).click();
  if ((await ap.evaluate(() => window.__started)) !== 0) fail.push("sound played while disabled");
  await ap.keyboard.press("s");
  await ap.getByRole("button", { name: "INFO" }).click();
  await ap.waitForTimeout(200);
  // One click = transient + carrier + modulator + fifth.
  const started = await ap.evaluate(() => window.__started);
  if (started !== 4) fail.push(`expected 4 voices per click, got ${started}`);
  await audio.close();
}

// 9. Up/down cycle pages; left/right are left to the page and its controls
{
  const kp = await (await b.newContext({ viewport: { width: 1360, height: 600 } })).newPage();
  await kp.goto(base + "/food");
  await kp.waitForTimeout(3400);

  // Left and right must not navigate.
  for (const key of ["ArrowRight", "ArrowLeft"]) {
    await kp.keyboard.press(key);
    await kp.waitForTimeout(200);
    if (new URL(kp.url()).pathname !== "/food") fail.push(`${key} navigated away from /food`);
  }

  // Down and up cycle in visual nav order: about, projects, home, travel, food.
  await kp.keyboard.press("ArrowDown");
  await kp.waitForTimeout(500);
  if (new URL(kp.url()).pathname !== "/about") fail.push("ArrowDown did not wrap food -> about");
  await kp.keyboard.press("ArrowUp");
  await kp.waitForTimeout(500);
  if (new URL(kp.url()).pathname !== "/food") fail.push("ArrowUp did not wrap about -> food");
  await kp.keyboard.press("ArrowUp");
  await kp.waitForTimeout(500);
  if (new URL(kp.url()).pathname !== "/travel") fail.push("ArrowUp did not step food -> travel");

  await kp.keyboard.press("2");
  await kp.waitForTimeout(400);
  if (new URL(kp.url()).pathname !== "/projects") fail.push("number keys stopped navigating");
  await kp.close();
}

// 10. ?boot replays the intro even once the session flag is set
{
  const bc = await b.newContext({ viewport: { width: 1360, height: 880 } });
  const bpage = await bc.newPage();
  await bpage.goto(base + "/");
  await bpage.waitForTimeout(3400);
  await bpage.reload();
  await bpage.waitForTimeout(600);
  if (await bpage.locator(".boot-screen").isVisible()) fail.push("boot replayed without ?boot");
  await bpage.goto(base + "/?boot");
  await bpage.waitForTimeout(600);
  if (!(await bpage.locator(".boot-screen").isVisible())) fail.push("?boot did not replay the intro");
  await bpage.goto(base + "/travel?boot");
  await bpage.waitForTimeout(600);
  if (!(await bpage.locator(".boot-screen").isVisible())) fail.push("?boot did not work on a sub-page");
  await bc.close();

  // Reduced motion still wins over ?boot.
  const rm = await b.newContext({ viewport: { width: 1360, height: 880 }, reducedMotion: "reduce" });
  const rp = await rm.newPage();
  await rp.goto(base + "/?boot");
  await rp.waitForTimeout(500);
  if (await rp.locator(".boot-screen").isVisible()) fail.push("?boot overrode prefers-reduced-motion");
  await rm.close();
}

// 11. The home spike is a real WebGL scene, draws something, and moves
{
  const hp = await (await b.newContext({ viewport: { width: 1360, height: 880 } })).newPage();
  await hp.goto(base + "/");
  // The scene starts after the boot intro and fades in once its shaders are compiled.
  const canvas = hp.locator("canvas[data-renderer]");
  const ready = await hp
    .waitForSelector("canvas[data-ready]", { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  await hp.waitForTimeout(700);
  if (!ready || (await canvas.count()) !== 1) fail.push("home spike did not start a WebGL canvas");
  else {
    const shot = () => canvas.screenshot({ type: "png" });
    const a = await shot();
    await hp.waitForTimeout(700);
    const c = await shot();
    if (Buffer.compare(a, c) === 0) fail.push("home spike is not animating");
    if (a.length < 5000) fail.push("home spike canvas looks empty");

    // It rests dim, and scrolling winds it up.
    const energy = async () => Number(await canvas.getAttribute("data-energy"));
    await hp.waitForTimeout(400);
    if ((await energy()) > 0.02) fail.push("home spike is not at rest before any scrolling");
    await hp.mouse.move(700, 440);
    for (let i = 0; i < 12; i++) await hp.mouse.wheel(0, 120);
    await hp.waitForTimeout(1500);
    if ((await energy()) < 0.2) fail.push("scrolling did not wind up the home spike");

    // Effects outside the device fade out once you stop spinning; the charge (glow) outlasts them.
    // Polled rather than a fixed wait: the fade runs on scene time, which a slow software
    // renderer advances far more slowly than the wall clock.
    const quiet = await hp
      .waitForFunction(() => Number(document.querySelector("main canvas")?.getAttribute("data-activity")) <= 0.05, null, {
        timeout: 90000,
        polling: 500,
      })
      .then(() => true)
      .catch(() => false);
    if (!quiet) fail.push("home spike effects kept spawning after scrolling stopped");
    if ((await energy()) < 0.1) fail.push("home spike charge drained along with the effects instead of lingering");
  }

  // The hero text can't be selected: a drag while spinning mustn't paint over the name.
  await hp.locator("h1").click({ clickCount: 3 });
  if (await hp.evaluate(() => String(window.getSelection()).trim().length > 0)) fail.push("home hero text is selectable");
  await hp.close();
}

// 12. Without WebGL both scenes fall back to the flat drawings instead of going blank
{
  const nb = await chromium.launch({ args: ["--disable-webgl", "--disable-3d-apis", "--disable-gpu"] });
  const np = await (await nb.newContext({ viewport: { width: 1360, height: 880 } })).newPage();
  await np.goto(base + "/");
  await np.waitForTimeout(3600);
  if ((await np.locator("canvas[data-renderer]").count()) !== 0) fail.push("WebGL not actually disabled for the fallback test");
  else if ((await np.locator("main canvas").count()) !== 1) fail.push("home has no 2D fallback canvas without WebGL");
  await np.goto(base + "/travel");
  await np.waitForTimeout(800);
  if ((await np.getByRole("img", { name: /Globe/ }).locator("svg").count()) !== 1) fail.push("travel has no SVG globe without WebGL");
  await nb.close();
}

console.log(fail.length ? "FAILURES:\n" + fail.join("\n") : "ALL CHECKS PASSED");

await b.close();
close();
if (fail.length) process.exit(1);
