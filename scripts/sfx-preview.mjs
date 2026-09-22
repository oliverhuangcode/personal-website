/**
 * Renders every UI click to a .wav so the sound can actually be listened to,
 * and fails if a waveform clips or gets cut off mid-swing (which pops).
 *
 *   npm run sfx:preview          -> sfx-preview/*.wav
 *
 * Bundles the real shipping module, so what you hear is what the site plays.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { build } from "esbuild";
import { chromium } from "playwright";

const S = "sfx-preview";
mkdirSync(`${S}/sfx`, { recursive: true });

const bundled = await build({
  entryPoints: ["src/lib/sound/voices.ts"],
  bundle: true,
  format: "iife",
  globalName: "SFX",
  write: false,
});
const voicesJs = bundled.outputFiles[0].text;

// Alternative characters to audition alongside the shipping set.
const VARIANTS = {
  shipping: null, // use VOICES as authored
  warm: { freqScale: 0.8, level: 1, decay: 1.5, tickHz: 0.6, tick: 0.5, ratio: 2.0, index: 0.5, snap: 1 },
  crisp: { freqScale: 1.25, level: 1, decay: 0.6, tickHz: 1.3, tick: 1.6, ratio: 1.15, index: 1.5, snap: 1 },
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: voicesJs });

const results = await page.evaluate(async ({ VARIANTS }) => {
  const { VOICES, scheduleClick } = window.SFX;
  const out = {};

  const render = async (voices, gapped) => {
    const names = Object.keys(voices);
    const dur = gapped ? names.length * 0.45 + 0.5 : 0.5;
    const ac = new OfflineAudioContext(1, Math.ceil(44100 * dur), 44100);
    const master = ac.createGain();
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 12;
    lim.attack.value = 0.001; lim.release.value = 0.08;
    master.gain.value = 0.9;
    master.connect(lim).connect(ac.destination);
    names.forEach((n, i) => scheduleClick(ac, master, voices[n], gapped ? 0.1 + i * 0.45 : 0.05));
    const buf = await ac.startRendering();
    return Array.from(buf.getChannelData(0));
  };

  for (const [variant, mod] of Object.entries(VARIANTS)) {
    const voices = {};
    for (const [name, v] of Object.entries(VOICES)) {
      voices[name] = mod
        ? { ...v, freq: v.freq * mod.freqScale, level: v.level * mod.level, decay: v.decay * mod.decay,
            tickHz: v.tickHz * mod.tickHz, tick: v.tick * mod.tick, ratio: v.ratio * mod.ratio,
            index: v.index * mod.index, snap: 1 + (v.snap - 1) * mod.snap }
        : v;
    }
    out[variant] = { sequence: await render(voices, true) };
    for (const [name, v] of Object.entries(voices)) {
      out[variant][name] = await render({ [name]: v }, false);
    }
  }
  return out;
}, { VARIANTS });

function wav(samples, rate = 44100) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * 32767))), 44 + i * 2));
  return buf;
}

const problems = [];
for (const [variant, set] of Object.entries(results)) {
  for (const [name, samples] of Object.entries(set)) {
    writeFileSync(`${S}/sfx/${variant}-${name}.wav`, wav(samples));
    const maxAbs = (arr) => arr.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
    const peak = maxAbs(samples);
    const clipped = samples.filter((s) => Math.abs(s) >= 0.999).length;
    // Does it actually end in silence, or is it cut off mid-swing (a pop)?
    const tail = maxAbs(samples.slice(-Math.floor(44100 * 0.005)));
    const audibleEnd = samples.findLastIndex((s) => Math.abs(s) > 0.001) / 44100;
    if (peak > 0.99) problems.push(`${variant}/${name}: peak ${peak.toFixed(3)}`);
    if (clipped) problems.push(`${variant}/${name}: ${clipped} clipped samples`);
    if (tail > 0.001) problems.push(`${variant}/${name}: tail not silent (${tail.toFixed(4)}) — will pop`);
    if (name !== "sequence") {
      console.log(`${variant.padEnd(9)} ${name.padEnd(12)} peak ${peak.toFixed(3)}  length ${(audibleEnd * 1000).toFixed(0)}ms`);
    }
  }
}
console.log(
  problems.length
    ? "PROBLEMS:\n" + problems.join("\n")
    : `\nwaveforms clean: no clipping, all tails silent -> ${S}/sfx/`,
);
await browser.close();
if (problems.length) process.exit(1);
