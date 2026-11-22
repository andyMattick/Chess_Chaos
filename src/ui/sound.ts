/**
 * Sound effects synthesised with the Web Audio API (no audio files, no
 * licences to worry about). Every sound is a few oscillators and noise bursts.
 */
let ctx: AudioContext | null = null;
let enabled = true;

let shaking = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Board shake and phone buzz on or off (the CSS side is body[data-calm]). */
export function setShakeEnabled(on: boolean) {
  shaking = on;
}

/** Vibrate the phone, unless shaking is switched off. */
export function buzz(pattern: number | number[]) {
  if (!shaking) return;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

/**
 * Phones only let a page make sound after a tap, and only if the sound system was
 * started inside that tap (owner, 2026-11-22: "I'm not hearing sound effects on my
 * phone"). The first sounds usually come from the bot's move, long after any tap, so
 * on every tap we start (or wake) the sound system with a silent blip. On iPhones we
 * also ask to play like a game (audioSession "playback"), so sounds are heard even
 * with the ring/silent switch on silent; turning Sound off in the app stops them.
 */
let unlockInstalled = false;
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const wake = () => {
    if (!enabled) return;
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== 'playback') session.type = 'playback';
    } catch { /* not an iPhone, or not allowed */ }
    const a = audio();
    if (!a) return;
    if (a.state !== 'running') void a.resume().catch(() => {});
    try {
      const b = a.createBuffer(1, 1, a.sampleRate);
      const src = a.createBufferSource();
      src.buffer = b;
      src.connect(a.destination);
      src.start(0);
    } catch { /* ignore */ }
  };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume().catch(() => {}); });
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.12, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, vol = 0.25, lowpass = 1800) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** Level-Up Chess sounds: square-wave blips in an old-school style (our own little tunes). */
export const luSfx = {
  select() { tone(880, 0, 0.05, 'square', 0.06); },
  dice() { for (let i = 0; i < 5; i++) tone(300 + i * 90, i * 0.05, 0.04, 'square', 0.05); },
  clash() { noise(0, 0.18, 0.3, 2400); tone(160, 0, 0.15, 'square', 0.08, 90); },
  win() { tone(523, 0, 0.08); tone(784, 0.08, 0.14); },
  lose() { tone(330, 0, 0.12, 'square', 0.08, 220); tone(196, 0.12, 0.2, 'square', 0.08); },
  boom() { noise(0, 0.4, 0.45, 900); tone(90, 0, 0.35, 'sawtooth', 0.1, 40); },
  warn() { tone(988, 0, 0.07, 'square', 0.06); tone(988, 0.14, 0.07, 'square', 0.06); },
  levelUp() {
    // A short climbing tune, then a held note.
    const notes = [392, 494, 587, 784, 698, 784, 988];
    notes.forEach((f, i) => tone(f, i * 0.09, i === notes.length - 1 ? 0.45 : 0.09, 'square', 0.09));
  },
  mission() { [659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.12, 'triangle', 0.1)); },
};

export const sfx = {
  /** Dice rattling. */
  dice() {
    for (let i = 0; i < 5; i++) noise(i * 0.06, 0.04, 0.18, 2400 + i * 300);
  },
  move() {
    tone(520 + Math.random() * 80, 0, 0.07, 'triangle', 0.08);
  },
  capture(big: boolean) {
    noise(0, big ? 0.45 : 0.22, big ? 0.45 : 0.3, big ? 900 : 1600);
    tone(big ? 110 : 180, 0, big ? 0.4 : 0.18, 'sawtooth', 0.14, 40);
  },
  check() {
    tone(880, 0, 0.12, 'square', 0.1);
    tone(660, 0.13, 0.12, 'square', 0.1);
    tone(880, 0.26, 0.16, 'square', 0.1);
  },
  mate() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'square', 0.1));
    noise(0.45, 0.6, 0.2, 3000);
  },
  promote() {
    tone(300, 0, 0.5, 'triangle', 0.12, 1400);
    tone(1200, 0.35, 0.2, 'sine', 0.1);
  },
  castle() {
    noise(0, 0.35, 0.18, 600);
    tone(200, 0, 0.3, 'sine', 0.1, 500);
  },
  lose() {
    [392, 330, 262].forEach((f, i) => tone(f, i * 0.18, 0.3, 'triangle', 0.1));
  },
  yourTurn() {
    tone(660, 0, 0.12, 'triangle', 0.12);
    tone(990, 0.12, 0.2, 'triangle', 0.12);
  },
  nudge() {
    tone(440, 0, 0.1, 'square', 0.1);
    tone(440, 0.16, 0.1, 'square', 0.1);
    tone(330, 0.32, 0.25, 'square', 0.1);
  },
  tick() {
    tone(1500, 0, 0.03, 'square', 0.04);
  },
};
