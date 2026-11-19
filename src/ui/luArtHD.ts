/**
 * Level-Up Chess "Storybook" art (owner, 2026-11-19: "better graphics OR stay
 * with the 8-bit"). Smooth, shaded SVG drawn in code: one picture per piece and
 * per terrain thing, in each army's colours. Original art; the 8-bit set lives
 * in luSprites.ts and the screen picks one through luTheme.ts.
 */
type Side = 'p1' | 'p2';

const INK = '#1b1830';
/** Each army: light, middle and dark tones (blue and red, as in the 8-bit set). */
const TEAM: Record<Side, [string, string, string]> = {
  p1: ['#e3edff', '#7aa0ec', '#2b4c9e'],
  p2: ['#ffd6cf', '#e5584c', '#8c1d2a'],
};
const GREY: [string, string, string] = ['#e7e5ee', '#9a97ab', '#55526a'];

function defs(c: [string, string, string]): string {
  return `<defs>
<linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
<linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
<radialGradient id="gold" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6c4"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#b8860b"/></radialGradient>
<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c58a4e"/><stop offset="1" stop-color="#6e4120"/></linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d93a6"/><stop offset=".5" stop-color="#4b5063"/><stop offset="1" stop-color="#23262f"/></linearGradient>
</defs>`;
}
const S = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`;
/** Shadow and the round stand every piece stands on (in its army's colour). */
const stand = `<ellipse cx="50" cy="88" rx="32" ry="7" fill="#000" opacity=".28"/><ellipse cx="50" cy="83" rx="29" ry="9" fill="url(#base)" ${S}/><ellipse cx="44" cy="80" rx="12" ry="2.5" fill="#fff" opacity=".35"/>`;
/** A soft shine on the left of the body. */
const shine = (x: number, y: number, rx: number, ry: number) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".38"/>`;

const PIECES: Record<string, (c: [string, string, string]) => string> = {
  pawn: () => `${stand}
<path d="M35 81 Q37 57 50 54 Q63 57 65 81 Z" fill="url(#body)" ${S}/>
<ellipse cx="50" cy="54" rx="13" ry="4.5" fill="url(#body)" ${S}/>
<circle cx="50" cy="38" r="13" fill="url(#body)" ${S}/>${shine(45, 33, 4, 5)}${shine(42, 68, 3, 8)}`,
  rook: () => `${stand}
<path d="M33 81 L36 42 L64 42 L67 81 Z" fill="url(#body)" ${S}/>
<path d="M29 22 h9 v6 h7 v-6 h10 v6 h7 v-6 h9 v20 h-42 Z" fill="url(#body)" ${S}/>
<rect x="46" y="52" width="8" height="14" rx="4" fill="${INK}" opacity=".75"/>${shine(40, 60, 3, 14)}`,
  bishop: () => `${stand}
<path d="M36 81 Q40 61 50 59 Q60 61 64 81 Z" fill="url(#body)" ${S}/>
<ellipse cx="50" cy="58" rx="12" ry="4" fill="url(#body)" ${S}/>
<path d="M50 15 C63 25 67 38 62 49 C58 57 42 57 38 49 C33 38 37 25 50 15 Z" fill="url(#body)" ${S}/>
<path d="M57 26 L46 42" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
<circle cx="50" cy="12" r="4.5" fill="url(#gold)" ${S}/>${shine(43, 34, 3.5, 8)}`,
  knight: () => `${stand}
<path d="M34 81 L37 63 C29 57 27 46 33 37 C38 27 47 19 57 17 L61 9 L66 19 C75 26 78 39 73 49 L63 47 C58 53 60 64 66 81 Z" fill="url(#body)" ${S}/>
<path d="M58 20 C50 26 46 34 47 44" fill="none" stroke="${INK}" stroke-width="2" opacity=".5"/>
<path d="M63 22 C70 30 72 38 70 44" fill="none" stroke="#fff" stroke-width="2.5" opacity=".45"/>
<circle cx="57" cy="31" r="3" fill="${INK}"/><circle cx="58" cy="30" r="1" fill="#fff"/>
<path d="M66 47 L72 49" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>${shine(40, 50, 3, 9)}`,
  queen: () => `${stand}
<path d="M35 81 Q37 54 50 45 Q63 54 65 81 Z" fill="url(#body)" ${S}/>
<path d="M31 38 L35 19 L43 31 L50 14 L57 31 L65 19 L69 38 Z" fill="url(#gold)" ${S}/>
<ellipse cx="50" cy="40" rx="19" ry="5" fill="url(#body)" ${S}/>
<circle cx="35" cy="18" r="3.4" fill="#ff5d8f" ${S}/><circle cx="50" cy="13" r="3.4" fill="#5de0ff" ${S}/><circle cx="65" cy="18" r="3.4" fill="#ff5d8f" ${S}/>${shine(42, 62, 3, 11)}`,
  king: () => `${stand}
<path d="M34 81 Q36 52 50 44 Q64 52 66 81 Z" fill="url(#body)" ${S}/>
<path d="M33 41 L35 25 L42 32 L50 23 L58 32 L65 25 L67 41 Z" fill="url(#gold)" ${S}/>
<rect x="47" y="7" width="6" height="18" rx="2" fill="url(#gold)" ${S}/><rect x="42" y="11" width="16" height="6" rx="2" fill="url(#gold)" ${S}/>
<ellipse cx="50" cy="42" rx="18" ry="4.5" fill="url(#body)" ${S}/>${shine(42, 62, 3, 11)}`,
  catapult: () => `<ellipse cx="50" cy="88" rx="36" ry="6" fill="#000" opacity=".28"/>
<path d="M40 58 L82 30 L88 39 L46 66 Z" fill="url(#metal)" ${S}/>
<ellipse cx="85" cy="34.5" rx="4" ry="6" transform="rotate(-34 85 34.5)" fill="${INK}"/>
<path d="M22 60 h46 l-6 16 h-34 Z" fill="url(#body)" ${S}/>
<circle cx="32" cy="76" r="10" fill="url(#wood)" ${S}/><circle cx="32" cy="76" r="3" fill="${INK}"/>
<circle cx="62" cy="76" r="10" fill="url(#wood)" ${S}/><circle cx="62" cy="76" r="3" fill="${INK}"/>
<path d="M32 66 v20 M22 76 h20 M62 66 v20 M52 76 h20" stroke="${INK}" stroke-width="1.6" opacity=".6"/>${shine(36, 64, 8, 2)}`,
  medic: () => `${stand}
<path d="M35 81 Q37 57 50 54 Q63 57 65 81 Z" fill="url(#body)" ${S}/>
<circle cx="50" cy="38" r="13" fill="url(#body)" ${S}/>
<path d="M37 34 Q50 20 63 34 Z" fill="#fff" ${S}/><path d="M48 25 h4 v3 h3 v4 h-3 v3 h-4 v-3 h-3 v-4 h3 Z" fill="#e8312f"/>
<circle cx="50" cy="68" r="8" fill="#fff" ${S}/><path d="M47.5 62 h5 v3.5 h3.5 v5 h-3.5 v3.5 h-5 v-3.5 h-3.5 v-5 h3.5 Z" fill="#e8312f"/>${shine(45, 40, 3, 4)}`,
  miner: () => `${stand}
<path d="M77 21 L63 60" stroke="url(#wood)" stroke-width="5" stroke-linecap="round"/><path d="M70 16 Q80 18 86 28 L76 24 Z" fill="url(#metal)" ${S}/>
<path d="M35 81 Q37 57 50 54 Q63 57 65 81 Z" fill="url(#body)" ${S}/>
<circle cx="50" cy="40" r="12" fill="#f2c8a0" ${S}/>
<path d="M35 38 Q36 22 50 22 Q64 22 65 38 Z" fill="#ffd23f" ${S}/><rect x="33" y="36" width="34" height="5" rx="2" fill="#e6b400" ${S}/>
<circle cx="50" cy="29" r="4" fill="#fffbe0" ${S}/><path d="M50 29 L40 6 L60 6 Z" fill="#fff8b0" opacity=".35"/>
<circle cx="45" cy="45" r="1.6" fill="${INK}"/><circle cx="55" cy="45" r="1.6" fill="${INK}"/>`,
  scout: (c) => `${stand}
<path d="M33 81 Q34 46 50 18 Q66 46 67 81 Z" fill="url(#body)" ${S}/>
<path d="M39 46 Q50 32 61 46 Q60 58 50 60 Q40 58 39 46 Z" fill="${c[2]}" ${S}/>
<ellipse cx="45" cy="48" rx="2.6" ry="1.8" fill="#ffe066"/><ellipse cx="55" cy="48" rx="2.6" ry="1.8" fill="#ffe066"/>
<rect x="56" y="64" width="22" height="6" rx="3" transform="rotate(-20 56 64)" fill="url(#gold)" ${S}/>${shine(41, 66, 3, 9)}`,
};

const TERRAIN: Record<string, string> = {
  mystery: `${stand.replace(/url\(#base\)/g, '#55526a')}
<path d="M33 81 Q34 46 50 20 Q66 46 67 81 Z" fill="url(#body)" ${S}/>
<path d="M39 48 Q50 34 61 48 Q60 60 50 62 Q40 60 39 48 Z" fill="#2c2a3a" ${S}/>
<text x="50" y="58" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="18" fill="#ffe066">?</text>`,
  tree: `<ellipse cx="50" cy="90" rx="30" ry="6" fill="#000" opacity=".3"/>
<path d="M44 90 L46 64 L54 64 L56 90 Z" fill="url(#wood)" ${S}/>
<circle cx="34" cy="52" r="17" fill="#2f7d32" ${S}/><circle cx="66" cy="52" r="17" fill="#2f7d32" ${S}/>
<circle cx="50" cy="34" r="22" fill="#3f9a3c" ${S}/><circle cx="50" cy="56" r="18" fill="#3f9a3c"/>
<circle cx="42" cy="28" r="8" fill="#7cd36a" opacity=".55"/><circle cx="30" cy="48" r="5" fill="#7cd36a" opacity=".45"/>`,
  stump: `<ellipse cx="50" cy="86" rx="28" ry="6" fill="#000" opacity=".3"/>
<path d="M32 62 L34 84 Q50 90 66 84 L68 62 Z" fill="url(#wood)" ${S}/>
<ellipse cx="50" cy="62" rx="18" ry="6" fill="#e2b27a" ${S}/><ellipse cx="50" cy="62" rx="10" ry="3" fill="none" stroke="#9b6a38" stroke-width="1.6"/>
<path d="M64 60 Q76 50 80 56 Q74 60 66 64 Z" fill="#3f9a3c" ${S}/>`,
  wall: `<ellipse cx="50" cy="90" rx="40" ry="5" fill="#000" opacity=".3"/>
<rect x="10" y="26" width="80" height="62" rx="4" fill="url(#stone)" ${S}/>
<path d="M10 46 H90 M10 67 H90 M36 26 V46 M64 26 V46 M24 46 V67 M50 46 V67 M76 46 V67 M36 67 V88 M64 67 V88" stroke="${INK}" stroke-width="2" opacity=".55"/>
<rect x="12" y="28" width="76" height="6" fill="#fff" opacity=".25"/>`,
  'wall-cracked': `<ellipse cx="50" cy="90" rx="40" ry="5" fill="#000" opacity=".3"/>
<path d="M10 88 V52 L28 44 L40 54 L56 40 L70 50 L90 46 V88 Z" fill="url(#stone)" ${S}/>
<path d="M10 67 H90 M24 52 V67 M50 50 V67 M76 48 V67 M36 67 V88 M64 67 V88" stroke="${INK}" stroke-width="2" opacity=".55"/>
<path d="M50 50 L46 62 L54 70 L48 84" fill="none" stroke="${INK}" stroke-width="2.4"/>
<circle cx="20" cy="88" r="4" fill="#8f8ca0" ${S}/><circle cx="82" cy="89" r="3" fill="#8f8ca0" ${S}/>`,
  mine: `<ellipse cx="50" cy="74" rx="24" ry="5" fill="#000" opacity=".3"/>
<path d="M50 30 V22 M30 50 H22 M70 50 H78 M36 36 L30 30 M64 36 L70 30 M36 64 L30 70 M64 64 L70 70" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
<circle cx="50" cy="50" r="20" fill="url(#metal)" ${S}/><circle cx="43" cy="43" r="6" fill="#fff" opacity=".3"/>
<circle cx="50" cy="50" r="5" fill="#ff3b3b" ${S}/><circle cx="50" cy="50" r="9" fill="#ff3b3b" opacity=".25"/>`,
  crater: `<ellipse cx="50" cy="54" rx="42" ry="30" fill="#7a5a3a" ${S}/>
<ellipse cx="50" cy="56" rx="32" ry="21" fill="url(#hole)"/>
<path d="M14 46 Q20 30 34 28 M66 26 Q82 30 88 48" fill="none" stroke="#a07a50" stroke-width="3" stroke-linecap="round"/>`,
};

const EXTRA_DEFS = `<defs>
<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9c6d6"/><stop offset="1" stop-color="#7d7a91"/></linearGradient>
<radialGradient id="hole" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#0d0a12"/><stop offset=".7" stop-color="#2b2017"/><stop offset="1" stop-color="#4a3826"/></radialGradient>
</defs>`;

const cache = new Map<string, string>();
/** A data URL for one Storybook picture (100 x 100), in this army's colours. */
export function hdUrl(name: string, side: Side = 'p1'): string {
  const key = `${name}:${side}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const piece = PIECES[name] as ((c: [string, string, string]) => string) | undefined;
  const inner = piece ? piece(TEAM[side]) : TERRAIN[name] ?? TERRAIN.mystery;
  const colours = piece ? TEAM[side] : GREY;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs(colours)}${EXTRA_DEFS}${inner}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, url);
  return url;
}
