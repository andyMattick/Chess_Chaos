import { useSyncExternalStore } from 'react';

/**
 * Collection skin art (docs/ART-PROMPTS.md). Art sheets live in public/skins
 * as <slug>-light.png and <slug>-dark.png, and public/skins/manifest.json
 * lists the slugs that have art. Until a slug is listed and loaded, its skin
 * draws a sparkly stand-in.
 */
const ready = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let started = false;

function start() {
  if (started || typeof window === 'undefined' || typeof Image === 'undefined') return;
  started = true;
  fetch('/skins/manifest.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((slugs: unknown) => {
      if (!Array.isArray(slugs)) return;
      for (const slug of slugs) {
        if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) continue;
        for (const side of ['light', 'dark']) {
          const img = new Image();
          img.onload = () => { ready.add(`${slug}:${side}`); version++; listeners.forEach((l) => l()); };
          img.src = `/skins/${slug}-${side}.png`;
        }
      }
    })
    .catch(() => {});
}

export function artReady(slug: string, side: 'p1' | 'p2'): boolean {
  start();
  return ready.has(`${slug}:${side === 'p1' ? 'light' : 'dark'}`);
}

/** Re-render when art arrives. */
export function useArt(): number {
  start();
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version, () => version);
}
