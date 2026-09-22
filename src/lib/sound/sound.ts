"use client";

import { useSyncExternalStore } from "react";

/** Pitches per interaction, in Hz. */
export const PITCH = {
  nav: 620,
  project: 900,
  tab: 780,
  photo: 760,
  destination: 840,
} as const;

const STORAGE_KEY = "oh:sfx";
const listeners = new Set<() => void>();
let enabled: boolean | null = null;
let ctx: AudioContext | null = null;

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function getEnabled(): boolean {
  if (enabled === null) enabled = readStored();
  return enabled;
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    // Storage blocked (private mode etc.): keep the in-memory preference.
  }
  listeners.forEach((l) => l());
}

export function toggleSound() {
  setSoundEnabled(!getEnabled());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sound is off by default and on the server; never auto-plays. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, getEnabled, () => false);
}

/**
 * A short synthesised UI click: a filtered noise transient for the
 * "mechanism" plus a downward triangle blip for the body.
 */
export function blip(freq: number) {
  if (!getEnabled()) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ctx ??= new Ctx();
    const ac = ctx;
    if (ac.state === "suspended") void ac.resume();
    const t = ac.currentTime;

    const out = ac.createGain();
    out.gain.value = 0.5;
    out.connect(ac.destination);

    // Transient: 40ms noise burst with a cubic decay, band-passed.
    const len = Math.floor(ac.sampleRate * 0.04);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq * 2.2;
    bp.Q.value = 1.1;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.16, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    noise.connect(bp).connect(ng).connect(out);
    noise.start(t);
    noise.stop(t + 0.05);

    // Body: triangle gliding down, low-passed so it stays dry.
    const osc = ac.createOscillator();
    const lp = ac.createBiquadFilter();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.82, t + 0.07);
    lp.type = "lowpass";
    lp.frequency.value = 5200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.11);
  } catch {
    // Audio is decorative; never let it break an interaction.
  }
}
