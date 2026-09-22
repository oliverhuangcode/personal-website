"use client";

import { useSyncExternalStore } from "react";

import { VOICES, scheduleClick, type VoiceName } from "./voices";

const STORAGE_KEY = "oh:sfx";
const listeners = new Set<() => void>();
let enabled: boolean | null = null;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

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
 * Play one UI click. Never throws: audio is decorative, and a blocked or
 * unavailable AudioContext must not break the interaction that triggered it.
 */
export function blip(name: VoiceName) {
  if (!getEnabled()) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!ctx) {
      ctx = new Ctx();
      // Master chain: a gentle limiter so overlapping clicks cannot clip.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(limiter).connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    scheduleClick(ctx, master!, VOICES[name], ctx.currentTime);
  } catch {
    // Audio is decorative; never let it break an interaction.
  }
}
