/**
 * UI click synthesis.
 *
 * Each click is three layers, which is what makes a click read as a physical
 * mechanism rather than a beep:
 *   1. transient — a few ms of filtered noise: the "contact"
 *   2. body     — an FM voice with an inharmonic ratio: the metallic ring
 *   3. partial  — a quiet fifth above, decaying faster: air and size
 *
 * Kept deliberately dry and short. Nothing here samples or imitates any
 * game's audio; it is all synthesised from oscillators and noise.
 */

export interface Voice {
  /** Base pitch in Hz. */
  freq: number;
  /** Peak level of the whole voice, 0–1. */
  level: number;
  /** Body decay in seconds. */
  decay: number;
  /** Transient brightness in Hz, and its level. */
  tickHz: number;
  tick: number;
  /**
   * FM modulator ratio. Non-integer values ring metallically (2.76 is the
   * classic inharmonic bell ratio); integers sound hollow and organ-like.
   */
  ratio: number;
  /** FM index, as a multiple of freq. Higher = more clang. */
  index: number;
  /** Pitch snap: body starts at freq × snap and settles to freq. */
  snap: number;
}

export const VOICES = {
  /** Page navigation — soft, low, gets out of the way. */
  nav: { freq: 420, level: 0.22, decay: 0.1, tickHz: 3200, tick: 0.05, ratio: 2.76, index: 1.2, snap: 1.04 },
  /** Project select — the "confirm": brighter, longer, more ring. */
  project: { freq: 660, level: 0.3, decay: 0.16, tickHz: 4200, tick: 0.07, ratio: 2.76, index: 2.4, snap: 1.06 },
  /** Destination select — same weight as project, a touch warmer. */
  destination: { freq: 560, level: 0.28, decay: 0.15, tickHz: 3800, tick: 0.06, ratio: 3.16, index: 2.0, snap: 1.05 },
  /** Tab switch — light and quick. */
  tab: { freq: 780, level: 0.18, decay: 0.07, tickHz: 4600, tick: 0.06, ratio: 2.4, index: 0.9, snap: 1.03 },
  /** Photo step — the lightest thing in the set. */
  photo: { freq: 880, level: 0.14, decay: 0.05, tickHz: 5200, tick: 0.05, ratio: 2.4, index: 0.6, snap: 1.02 },
} as const satisfies Record<string, Voice>;

export type VoiceName = keyof typeof VOICES;

const TICK_SECONDS = 0.012;
/** Web Audio cannot ramp exponentially to zero. */
const SILENCE = 0.0001;

/** Short noise burst with a steep decay — the contact transient. */
function tickBuffer(ac: BaseAudioContext): AudioBuffer {
  const len = Math.max(1, Math.floor(ac.sampleRate * TICK_SECONDS));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  }
  return buf;
}

/**
 * Schedule one click at time `t` into `out`.
 * Works with both AudioContext and OfflineAudioContext, so the exact sound
 * that ships can be rendered and inspected in tests.
 */
export function scheduleClick(ac: BaseAudioContext, out: AudioNode, v: Voice, t: number): number {
  // A few cents of drift stops rapid repeats sounding machine-gunned.
  const freq = v.freq * (1 + (Math.random() - 0.5) * 0.008);
  const end = t + v.decay + 0.02;

  // 1. Transient.
  const noise = ac.createBufferSource();
  noise.buffer = tickBuffer(ac);
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = v.tickHz;
  const tickGain = ac.createGain();
  tickGain.gain.setValueAtTime(v.tick, t);
  tickGain.gain.exponentialRampToValueAtTime(SILENCE, t + TICK_SECONDS * 1.6);
  noise.connect(hp).connect(tickGain).connect(out);
  noise.start(t);
  noise.stop(t + TICK_SECONDS * 2);

  // 2. Body: FM carrier with an inharmonic modulator.
  const carrier = ac.createOscillator();
  carrier.type = "sine";
  carrier.frequency.setValueAtTime(freq * v.snap, t);
  carrier.frequency.exponentialRampToValueAtTime(freq, t + 0.03);

  const mod = ac.createOscillator();
  mod.type = "sine";
  mod.frequency.value = freq * v.ratio;
  const modDepth = ac.createGain();
  modDepth.gain.setValueAtTime(freq * v.index, t);
  // The index collapses fast: bright on attack, pure on the tail.
  modDepth.gain.exponentialRampToValueAtTime(freq * 0.01, t + v.decay * 0.5);
  mod.connect(modDepth).connect(carrier.frequency);

  const bodyGain = ac.createGain();
  bodyGain.gain.setValueAtTime(SILENCE, t);
  bodyGain.gain.exponentialRampToValueAtTime(v.level, t + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(SILENCE, t + v.decay);
  bodyGain.gain.setValueAtTime(0, end);
  carrier.connect(bodyGain).connect(out);

  // 3. Quiet fifth, decaying faster than the body.
  const fifth = ac.createOscillator();
  fifth.type = "sine";
  fifth.frequency.value = freq * 1.5;
  const fifthGain = ac.createGain();
  fifthGain.gain.setValueAtTime(SILENCE, t);
  fifthGain.gain.exponentialRampToValueAtTime(v.level * 0.28, t + 0.004);
  fifthGain.gain.exponentialRampToValueAtTime(SILENCE, t + v.decay * 0.6);
  fifthGain.gain.setValueAtTime(0, end);
  fifth.connect(fifthGain).connect(out);

  for (const osc of [carrier, mod, fifth]) {
    osc.start(t);
    osc.stop(end);
  }
  return end;
}
