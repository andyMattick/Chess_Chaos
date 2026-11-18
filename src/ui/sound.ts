/**
 * Sound effects synthesised with the Web Audio API (no audio files, no
 * licences to worry about). Every sound is a few oscillators and noise bursts.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
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

export const sfx = {
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
  tick() {
    tone(1500, 0, 0.03, 'square', 0.04);
  },
};
