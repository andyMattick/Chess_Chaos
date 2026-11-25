import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { skinFor } from '../content/cosmetics';
import { doorOf, WORLD_H, WORLD_START, WORLD_W, type Place } from '../content/world';
import { buildWorld, doorPlace, groundAt, pathTo, placeOn, walkable, type Tile } from '../systems/world';
import { lookOf } from '../storage/storage';
import { Character } from './skins';
import { useSave } from './store';
import { IconShapes, PLACE_ICON, PlaceIcon } from './icons';

/**
 * The main screen as a little world to walk around (owner, 2026-11-22): tap
 * anywhere to walk there (tap a building to walk to its door), or use the arrow
 * pad / arrow keys. At a door, a card says where you are: "Go in".
 * Our own art, drawn in code: grass, roads, trees, flowers, the sea and houses.
 */
const U = 40; // SVG units per tile
const STEP_MS = 150;

/** Where you were standing, so coming back Home puts you outside the door you went in. */
let lastSpot: Tile = { ...WORLD_START };

export function WorldMap({ places, badges, enter }: { places: Place[]; badges: Record<string, string>; enter: (p: Place) => void }) {
  const save = useSave();
  const world = useMemo(() => buildWorld(places), [places]);
  const [hero, setHero] = useState<Tile>(() => (walkable(world, lastSpot) ? lastSpot : { ...WORLD_START }));
  const [facing, setFacing] = useState<1 | -1>(1);
  const [route, setRoute] = useState<Tile[]>([]);
  const [target, setTarget] = useState<Place | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 480 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // One step at a time along the route.
  useEffect(() => {
    if (!route.length) return;
    const t = window.setTimeout(() => {
      const [next, ...rest] = route;
      setFacing((f) => (next.x < hero.x ? -1 : next.x > hero.x ? 1 : f));
      setHero(next);
      lastSpot = next;
      setRoute(rest);
    }, STEP_MS);
    return () => window.clearTimeout(t);
  }, [route, hero]);

  const here = route.length ? null : doorPlace(world, hero);
  // The card: where you are standing, or (while walking there) the place you tapped, with a short description.
  const card = here ?? (route.length && target ? target : null);

  function walkTo(t: Tile) {
    const p = placeOn(world, t);
    if (p && here && here.id === p.id) { enter(p); return; }
    const path = pathTo(world, hero, t);
    setTarget(p);
    setRoute(path);
  }

  function step(dx: number, dy: number) {
    const n = { x: hero.x + dx, y: hero.y + dy };
    if (dx) setFacing(dx < 0 ? -1 : 1);
    if (!walkable(world, n)) {
      // Bumping into a house from its door goes in.
      const p = placeOn(world, n);
      if (p && here?.id === p.id) enter(p);
      return;
    }
    setRoute([]);
    setHero(n);
    lastSpot = n;
  }

  // Arrow keys / WASD, Enter or Space to go in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (document.querySelector('.number-modal, .quest-modal')) return;
      const k = e.key.toLowerCase();
      const d = k === 'arrowup' || k === 'w' ? [0, -1] : k === 'arrowdown' || k === 's' ? [0, 1] : k === 'arrowleft' || k === 'a' ? [-1, 0] : k === 'arrowright' || k === 'd' ? [1, 0] : null;
      if (d) { e.preventDefault(); step(d[0], d[1]); return; }
      if ((k === 'enter' || k === ' ') && here && el?.tagName !== 'BUTTON') { e.preventDefault(); enter(here); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Camera: keep the hero in the middle, never past the edge of the world.
  const T = Math.max(38, Math.min(64, box.w / 9));
  const worldW = WORLD_W * T, worldH = WORLD_H * T;
  const camX = Math.min(0, Math.max(box.w - worldW, box.w / 2 - (hero.x + 0.5) * T));
  const camY = Math.min(0, Math.max(box.h - worldH, box.h / 2 - (hero.y + 0.5) * T));

  function onTap(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const t = { x: Math.floor(((e.clientX - r.left) / r.width) * WORLD_W), y: Math.floor(((e.clientY - r.top) / r.height) * WORLD_H) };
    walkTo(t);
  }

  const skin = skinFor(lookOf(save).skins, 'p1', 'king');
  const walking = route.length > 0;

  return (
    <div className="world">
      <div className="world-view" ref={boxRef}>
        <svg
          className="world-map" viewBox={`0 0 ${WORLD_W * U} ${WORLD_H * U}`} width={worldW} height={worldH}
          style={{ transform: `translate(${camX}px, ${camY}px)` }} onPointerUp={onTap} role="img" aria-label="Map of the World of C.H.A.O.S."
        >
          <Ground world={world} />
          {places.map((p) => <House key={p.id} p={p} badge={badges[p.id]} glow={target?.id === p.id || here?.id === p.id} />)}
          <g className={`world-hero ${walking ? 'walking' : ''}`} style={{ transform: `translate(${hero.x * U}px, ${hero.y * U}px)` }}>
            <ellipse cx={U / 2} cy={U - 4} rx={13} ry={4} fill="rgba(0,0,0,0.25)" />
            <g transform={`translate(${U / 2} 0) scale(${facing} 1) translate(${-U / 2} 0)`}>
              <g className="hero-bob" transform={`translate(-8 -14) scale(${(U + 16) / 100})`}>
                <Character skin={skin} type="king" owner="p1" seed={7} />
              </g>
            </g>
          </g>
        </svg>
        {card && (
          <div className="world-card" role="status" key={card.id}>
            <PlaceIcon id={card.id} emoji={card.emoji} className="world-card-emoji" />
            <span><b>{card.name}</b><small>{card.about}</small></span>
            <button className="btn primary" onClick={() => enter(card)}>{here ? 'Go in' : 'Go'}</button>
          </div>
        )}
        <div className="dpad" aria-label="Walk">
          <button aria-label="Walk up" className="up" onClick={() => step(0, -1)}>▲</button>
          <button aria-label="Walk left" className="left" onClick={() => step(-1, 0)}>◀</button>
          <button aria-label="Walk right" className="right" onClick={() => step(1, 0)}>▶</button>
          <button aria-label="Walk down" className="down" onClick={() => step(0, 1)}>▼</button>
        </div>
      </div>
    </div>
  );
}

function Ground({ world }: { world: ReturnType<typeof buildWorld> }) {
  const out: ReactElement[] = [];
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    const g = groundAt(world, { x, y });
    const X = x * U, Y = y * U, k = `${x},${y}`;
    const grass = (x + y) % 2 ? '#7fcf6b' : '#77c763';
    if (g === 'water') {
      out.push(<g key={k}><rect x={X} y={Y} width={U} height={U} fill={(x + y) % 2 ? '#4aa8ff' : '#45a0f5'} /><path className="wave" d={`M${X + 6} ${Y + 16} q5 -5 10 0 t10 0 M${X + 14} ${Y + 30} q5 -5 10 0`} stroke="#d6efff" strokeWidth={2.5} fill="none" strokeLinecap="round" /></g>);
      continue;
    }
    out.push(<rect key={k} x={X} y={Y} width={U + 0.5} height={U + 0.5} fill={g === 'road' ? '#e9d08f' : grass} />);
    if (g === 'road') out.push(<g key={`${k}r`} fill="#cfae63"><circle cx={X + 9 + ((x * 7) % 13)} cy={Y + 12 + ((y * 5) % 11)} r={1.8} /><circle cx={X + 27 - ((y * 3) % 9)} cy={Y + 29} r={1.4} /></g>);
    if (g === 'grass' && (x * 3 + y * 5) % 4 === 0) out.push(<path key={`${k}t`} d={`M${X + 12} ${Y + 26} l2 -6 l2 6 M${X + 26} ${Y + 16} l2 -5 l2 5`} stroke="#4f9a44" strokeWidth={2} fill="none" strokeLinecap="round" />);
    if (g === 'flowers') out.push(<g key={`${k}f`}>{[[11, 13, '#ff6fb5'], [27, 18, '#ffd84a'], [17, 29, '#ffffff'], [31, 31, '#ff8a3c']].map(([a, b, c], i) => <g key={i}><circle cx={X + (a as number)} cy={Y + (b as number)} r={3.4} fill={c as string} stroke="#2d2a3e" strokeWidth={1} /><circle cx={X + (a as number)} cy={Y + (b as number)} r={1.2} fill="#ffb13d" /></g>)}</g>);
    if (g === 'tree') out.push(<Tree key={`${k}tr`} X={X} Y={Y} kind={treeKind(x, y)} />);
  }
  return <g>{out}</g>;
}

/** Which tree grows on a tile: mostly leafy oaks, some pines, a few with apples or blossom (same every time). */
function treeKind(x: number, y: number): 'oak' | 'pine' | 'apple' | 'blossom' {
  let h = (x * 374761393 + y * 668265263 + 97) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  const r = ((h ^ (h >>> 16)) >>> 0) % 20;
  return r < 12 ? 'oak' : r < 17 ? 'pine' : r < 19 ? 'apple' : 'blossom';
}

const INK = '#2d2a3e';

/** Trees of our own: a soft shadow, a trunk with roots, and a layered canopy (dark under, light on top). */
function Tree({ X, Y, kind }: { X: number; Y: number; kind: 'oak' | 'pine' | 'apple' | 'blossom' }) {
  const cx = X + 20;
  const sway = { transformOrigin: `${cx}px ${Y + 34}px` };
  if (kind === 'pine') {
    return (
      <g>
        <ellipse cx={cx} cy={Y + 36} rx={11} ry={3.5} fill="rgba(0,0,0,0.22)" />
        <rect x={cx - 3} y={Y + 28} width={6} height={8} rx={1.5} fill="#7a4a22" stroke={INK} strokeWidth={1.8} />
        <g className="tree-sway" style={sway}>
          <path d={`M${cx} ${Y - 6} L${cx + 10} ${Y + 8} H${cx + 6} L${cx + 14} ${Y + 19} H${cx + 9} L${cx + 17} ${Y + 30} H${cx - 17} L${cx - 9} ${Y + 19} H${cx - 14} L${cx - 6} ${Y + 8} H${cx - 10} Z`} fill="#2f7d4f" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
          <path d={`M${cx} ${Y - 1} L${cx + 5} ${Y + 7} M${cx - 2} ${Y + 11} L${cx + 7} ${Y + 18} M${cx - 3} ${Y + 22} L${cx + 9} ${Y + 29}`} stroke="#4fae6e" strokeWidth={3} strokeLinecap="round" />
          <path d={`M${cx - 9} ${Y + 19} L${cx - 4} ${Y + 15} M${cx - 13} ${Y + 29} L${cx - 7} ${Y + 25}`} stroke="#22603c" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      </g>
    );
  }
  const leaf = kind === 'blossom' ? { dark: '#d9669b', mid: '#f08cbc', light: '#ffc2de' } : { dark: '#2f8a3f', mid: '#45a852', light: '#7fd07a' };
  return (
    <g>
      <ellipse cx={cx} cy={Y + 36} rx={15} ry={4.5} fill="rgba(0,0,0,0.22)" />
      <path d={`M${cx - 4} ${Y + 36} q1 -6 1 -12 h6 q0 6 1 12 l4 1 h-16 z`} fill="#8a5a2b" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={`M${cx - 1} ${Y + 30} v5`} stroke="#6b421d" strokeWidth={1.5} />
      <g className="tree-sway" style={sway}>
        {/* outline blob, then the dark underside, the middle, and sunny highlights */}
        <g stroke={INK} strokeWidth={4.5}>
          <circle cx={cx - 8} cy={Y + 16} r={9} /><circle cx={cx + 8} cy={Y + 16} r={9} /><circle cx={cx} cy={Y + 8} r={10} /><circle cx={cx} cy={Y + 20} r={10} />
        </g>
        <g fill={leaf.dark}>
          <circle cx={cx - 8} cy={Y + 16} r={9} /><circle cx={cx + 8} cy={Y + 16} r={9} /><circle cx={cx} cy={Y + 8} r={10} /><circle cx={cx} cy={Y + 20} r={10} />
        </g>
        <g fill={leaf.mid}>
          <circle cx={cx - 5} cy={Y + 12} r={7.5} /><circle cx={cx + 5} cy={Y + 11} r={7} /><circle cx={cx + 1} cy={Y + 17} r={6.5} />
        </g>
        <g fill={leaf.light}>
          <circle cx={cx - 6} cy={Y + 9} r={3.6} /><circle cx={cx + 3} cy={Y + 6} r={2.8} /><circle cx={cx - 1} cy={Y + 14} r={2.2} />
        </g>
        {kind === 'apple' && <g fill="#e8413c" stroke={INK} strokeWidth={1}><circle cx={cx - 9} cy={Y + 19} r={2.6} /><circle cx={cx + 7} cy={Y + 21} r={2.6} /><circle cx={cx + 9} cy={Y + 12} r={2.4} /></g>}
        {kind === 'blossom' && <g fill="#fff"><circle cx={cx - 10} cy={Y + 18} r={1.6} /><circle cx={cx + 6} cy={Y + 22} r={1.6} /><circle cx={cx + 10} cy={Y + 13} r={1.4} /><circle cx={cx - 2} cy={Y + 4} r={1.4} /></g>}
      </g>
    </g>
  );
}

function House({ p, badge, glow }: { p: Place; badge?: string; glow: boolean }) {
  const X = p.x * U, Y = p.y * U, W = p.w * U, H = p.h * U;
  const d = doorOf(p);
  const doorX = d.x * U + U / 2;
  if (p.id === 'quests') {
    // A wooden notice board with paper notes.
    return (
      <g className={`house ${glow ? 'glow' : ''}`} aria-label={p.name}>
        <rect x={X + 10} y={Y + 24} width={6} height={16} fill="#8a5a2b" /><rect x={X + W - 16} y={Y + 24} width={6} height={16} fill="#8a5a2b" />
        <rect x={X + 4} y={Y + 2} width={W - 8} height={28} rx={4} fill="#b77a3d" stroke="#2d2a3e" strokeWidth={2.5} />
        <rect x={X + 12} y={Y + 7} width={16} height={18} fill="#fffaf0" stroke="#2d2a3e" strokeWidth={1.5} transform={`rotate(-6 ${X + 20} ${Y + 16})`} />
        <rect x={X + 34} y={Y + 6} width={16} height={18} fill="#fff3a8" stroke="#2d2a3e" strokeWidth={1.5} transform={`rotate(5 ${X + 42} ${Y + 15})`} />
        <rect x={X + 54} y={Y + 8} width={14} height={16} fill="#cfe9ff" stroke="#2d2a3e" strokeWidth={1.5} />
        <Label x={X + W / 2} y={Y + H + 1} text={p.name} />
        {badge && <Badge x={X + W - 4} y={Y + 2} text={badge} />}
      </g>
    );
  }
  if (p.id === 'signpost') {
    return (
      <g className={`house ${glow ? 'glow' : ''}`} aria-label={p.name}>
        <rect x={X + 17} y={Y + 10} width={6} height={30} fill="#8a5a2b" stroke="#2d2a3e" strokeWidth={1.5} />
        <path d={`M${X + 2} ${Y + 6} h30 l7 7 l-7 7 h-30 z`} fill={p.wall} stroke="#2d2a3e" strokeWidth={2} />
        {PLACE_ICON[p.id] ? <IconShapes name={PLACE_ICON[p.id]} x={X + 11} y={Y + 6.5} size={14} /> : <text x={X + 18} y={Y + 18} fontSize={12} textAnchor="middle">{p.emoji}</text>}
        <Label x={X + U / 2} y={Y + H + 1} text="Chess.com" />
      </g>
    );
  }
  const roofH = Math.min(H * 0.55, 46);
  const wallTop = Y + roofH - 6;
  const clip = `roof-${p.id}`;
  const winY = Y + roofH + 6;
  const wins = W > U * 2 ? [X + 12, X + W - 30] : [];
  const isCave = p.id === 'cave';
  if (isCave) return <Cave p={p} X={X} Y={Y} W={W} H={H} doorX={doorX} badge={badge} glow={glow} />;
  const roof = `M${X} ${Y + roofH} L${X + 10} ${Y + 4} H${X + W - 10} L${X + W} ${Y + roofH} Z`;
  const striped = p.id === 'carnival' || p.id === 'arena';
  return (
    <g className={`house ${glow ? 'glow' : ''}`} aria-label={p.name}>
      <defs><clipPath id={clip}><path d={roof} /></clipPath></defs>
      <ellipse cx={X + W / 2} cy={Y + H - 1} rx={W / 2 - 2} ry={5} fill="rgba(0,0,0,0.22)" />
      {/* Behind the roof: chimneys, towers, flags */}
      {p.id === 'tower' && <TowerTop X={X} Y={Y} W={W} roof={p.roof} />}
      {!striped && p.id !== 'tower' && p.id !== 'ring' && (
        <g>
          <rect x={X + W - 26} y={Y - 2} width={10} height={16} fill="#b45a3c" stroke={INK} strokeWidth={2} />
          <rect x={X + W - 28} y={Y - 5} width={14} height={4} rx={1} fill="#8a3f28" stroke={INK} strokeWidth={1.5} />
          <g className="smoke" fill="rgba(255,255,255,0.75)"><circle cx={X + W - 20} cy={Y - 10} r={3.5} /><circle cx={X + W - 15} cy={Y - 17} r={4.5} /><circle cx={X + W - 9} cy={Y - 25} r={5.5} /></g>
        </g>
      )}
      {p.id === 'ring' && [X + 6, X + W - 6].map((fx, i) => <g key={i}><path d={`M${fx} ${Y + roofH} V${Y - 8}`} stroke={INK} strokeWidth={2} /><path d={`M${fx} ${Y - 8} l${i ? -12 : 12} 4 l${i ? 12 : -12} 4 z`} fill={i ? '#4aa8ff' : '#ff5a3c'} stroke={INK} strokeWidth={1.5} /></g>)}
      {/* Walls: brick (or logs for the woods cabin), with a stone footing */}
      <rect x={X + 5} y={wallTop} width={W - 10} height={H - roofH + 4} rx={3} fill={p.wall} stroke={INK} strokeWidth={2.5} />
      <g stroke="rgba(45,42,62,0.16)" strokeWidth={1.2}>
        {Array.from({ length: Math.floor((H - roofH) / 7) }, (_, i) => {
          const yy = wallTop + 6 + i * 7;
          return p.id === 'woods'
            ? <path key={i} d={`M${X + 6} ${yy} H${X + W - 6}`} stroke="rgba(90,58,34,0.45)" strokeWidth={2} />
            : <g key={i}><path d={`M${X + 6} ${yy} H${X + W - 6}`} />{Array.from({ length: Math.floor(W / 14) }, (_, j) => <path key={j} d={`M${X + 9 + j * 14 + (i % 2) * 7} ${yy} v-7`} />)}</g>;
        })}
      </g>
      <rect x={X + 5} y={Y + H - 7} width={W - 10} height={5} fill="#9a917f" stroke={INK} strokeWidth={1.5} />
      {/* Windows: frame, panes, shutters, a flower box */}
      {wins.map((wx, i) => (
        <g key={i}>
          {p.id === 'cards' || p.id === 'tailor' ? <path d={`M${wx - 3} ${winY - 6} h24 l-3 6 h-18 z`} fill={p.roof} stroke={INK} strokeWidth={1.5} /> : null}
          <rect x={wx - 3} y={winY - 1} width={4} height={14} fill={p.roof} stroke={INK} strokeWidth={1.2} />
          <rect x={wx + 15} y={winY - 1} width={4} height={14} fill={p.roof} stroke={INK} strokeWidth={1.2} />
          <rect x={wx + 1} y={winY} width={14} height={12} rx={1.5} fill="#bfe3ff" stroke={INK} strokeWidth={2} />
          <path d={`M${wx + 8} ${winY} v12 M${wx + 1} ${winY + 6} h14`} stroke="#fffaf0" strokeWidth={1.6} />
          <path d={`M${wx + 3} ${winY + 3} l3 -2`} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
          <rect x={wx} y={winY + 12} width={16} height={4} fill="#8a5a2b" stroke={INK} strokeWidth={1} />
          <circle cx={wx + 4} cy={winY + 11} r={1.8} fill="#ff6fb5" /><circle cx={wx + 8} cy={winY + 10.5} r={1.8} fill="#ffd84a" /><circle cx={wx + 12} cy={winY + 11} r={1.8} fill="#ff6fb5" />
        </g>
      ))}
      {/* Roof: shingles (or circus stripes), a light ridge, and a shadow under the eaves */}
      <path d={roof} fill={p.roof} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`}>
        {striped
          ? Array.from({ length: Math.ceil(W / 16) + 1 }, (_, i) => <rect key={i} x={X + i * 16} y={Y} width={8} height={roofH} fill="rgba(255,255,255,0.55)" />)
          : Array.from({ length: Math.ceil(roofH / 8) }, (_, r) => (
            <path key={r} d={Array.from({ length: Math.ceil(W / 10) + 1 }, (_, i) => `M${X + i * 10 - (r % 2) * 5} ${Y + 10 + r * 8} a5 4 0 0 0 10 0`).join(' ')} fill="none" stroke="rgba(45,42,62,0.28)" strokeWidth={1.4} />
          ))}
        <path d={`M${X} ${Y + roofH - 3} H${X + W}`} stroke="rgba(0,0,0,0.25)" strokeWidth={4} />
      </g>
      <path d={roof} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d={`M${X + 12} ${Y + 7} H${X + W - 12}`} stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeLinecap="round" />
      {p.id === 'arena' && <path d={Array.from({ length: Math.floor(W / 12) }, (_, i) => `M${X + 4 + i * 12} ${Y + roofH - 2} l6 8 l6 -8`).join(' ')} fill="#ffd84a" stroke={INK} strokeWidth={1.2} />}
      {/* Columns by the library and hall doors */}
      {(p.id === 'library' || p.id === 'fame') && [doorX - 17, doorX + 12].map((cx, i) => <rect key={i} x={cx} y={wallTop + 4} width={5} height={H - roofH - 6} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />)}
      {/* Door: steps, planks, a lamp */}
      <rect x={doorX - 12} y={Y + H - 4} width={24} height={4} rx={1.5} fill="#bdb4a2" stroke={INK} strokeWidth={1.4} />
      <path d={`M${doorX - 9} ${Y + H - 4} v-13 a9 9 0 0 1 18 0 v13 z`} fill="#6b4426" stroke={INK} strokeWidth={2} />
      <path d={`M${doorX - 3} ${Y + H - 4} v-20 M${doorX + 3} ${Y + H - 4} v-20`} stroke="rgba(0,0,0,0.25)" strokeWidth={1.2} />
      <circle cx={doorX + 5} cy={Y + H - 11} r={1.6} fill="#ffd84a" />
      <g><rect x={doorX + 12} y={Y + H - 26} width={2} height={6} fill={INK} /><rect x={doorX + 10} y={Y + H - 21} width={6} height={7} rx={1.5} fill="#ffe27a" stroke={INK} strokeWidth={1.2} className="lamp" /></g>
      {p.id === 'post' && <g><rect x={X + W - 4} y={Y + H - 20} width={3} height={18} fill={INK} /><rect x={X + W - 10} y={Y + H - 27} width={14} height={9} rx={4} fill="#e8413c" stroke={INK} strokeWidth={1.5} /></g>}
      {p.id === 'harbour' && <g><circle cx={X + 10} cy={wallTop + 12} r={6} fill="none" stroke="#fff" strokeWidth={4} /><circle cx={X + 10} cy={wallTop + 12} r={6} fill="none" stroke="#e8413c" strokeWidth={4} strokeDasharray="4.7 4.7" /></g>}
      {p.id === 'fame' && <path d={`M${X + W / 2} ${Y - 8} l3 6 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1 z`} fill="#ffd84a" stroke={INK} strokeWidth={1.5} />}
      {p.id === 'school' && <g><rect x={X + W / 2 - 7} y={Y - 10} width={14} height={14} fill={p.wall} stroke={INK} strokeWidth={1.5} /><path d={`M${X + W / 2 - 9} ${Y - 10} l9 -8 l9 8 z`} fill={p.roof} stroke={INK} strokeWidth={1.5} /><circle cx={X + W / 2} cy={Y - 3} r={3} fill="#ffd84a" stroke={INK} strokeWidth={1} /></g>}
      {/* The sign: the place's picture on a round plaque */}
      <circle cx={X + W / 2} cy={Y + roofH / 2 + 2} r={Math.min(15, roofH * 0.36)} fill="rgba(255,250,240,0.9)" stroke={INK} strokeWidth={2} />
      {PLACE_ICON[p.id] ? <IconShapes name={PLACE_ICON[p.id]} x={X + W / 2 - Math.min(11, roofH * 0.27)} y={Y + roofH / 2 + 2 - Math.min(11, roofH * 0.27)} size={Math.min(22, roofH * 0.54)} /> : <text x={X + W / 2} y={Y + roofH / 2 + 9} fontSize={Math.min(20, roofH * 0.48)} textAnchor="middle">{p.emoji}</text>}
      <Label x={X + W / 2} y={Y + H + 1} text={p.name} />
      {badge && <Badge x={X + W - 6} y={Y + 6} text={badge} />}
    </g>
  );
}

/** The Bot Tower's top: battlements and a flag. */
function TowerTop({ X, Y, W, roof }: { X: number; Y: number; W: number; roof: string }) {
  return (
    <g>
      <rect x={X + W / 2 - 14} y={Y - 16} width={28} height={26} fill="#d9d2c3" stroke={INK} strokeWidth={2} />
      {[0, 1, 2].map((i) => <rect key={i} x={X + W / 2 - 14 + i * 11} y={Y - 22} width={7} height={7} fill="#d9d2c3" stroke={INK} strokeWidth={1.5} />)}
      <rect x={X + W / 2 - 4} y={Y - 10} width={8} height={10} rx={4} fill="#3a3550" />
      <path d={`M${X + W / 2} ${Y - 22} V${Y - 40}`} stroke={INK} strokeWidth={2} />
      <path className="flag" d={`M${X + W / 2} ${Y - 40} l16 5 l-16 5 z`} fill={roof} stroke={INK} strokeWidth={1.5} />
    </g>
  );
}

/** The Puzzle Cave: a rocky hill with a dark way in. */
function Cave({ p, X, Y, W, H, doorX, badge, glow }: { p: Place; X: number; Y: number; W: number; H: number; doorX: number; badge?: string; glow: boolean }) {
  return (
    <g className={`house ${glow ? 'glow' : ''}`} aria-label={p.name}>
      <ellipse cx={X + W / 2} cy={Y + H - 1} rx={W / 2 - 2} ry={5} fill="rgba(0,0,0,0.22)" />
      <path d={`M${X + 2} ${Y + H - 2} Q${X + 4} ${Y + 18} ${X + W * 0.3} ${Y + 8} Q${X + W * 0.5} ${Y - 6} ${X + W * 0.72} ${Y + 8} Q${X + W - 2} ${Y + 18} ${X + W - 2} ${Y + H - 2} Z`} fill="#8a7f73" stroke={INK} strokeWidth={2.5} />
      <path d={`M${X + 14} ${Y + 30} q10 -8 20 -2 M${X + W - 40} ${Y + 22} q10 -6 22 0 M${X + 30} ${Y + 52} q8 -5 16 0`} stroke="#6e655c" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={`M${X + W * 0.35} ${Y + 12} q8 -6 16 -2`} stroke="#b3a99c" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={`M${X + W - 22} ${Y + 14} q4 -8 10 -4 q-2 6 -10 4`} fill="#5cc265" stroke={INK} strokeWidth={1.2} />
      <path d={`M${doorX - 15} ${Y + H - 2} v-14 a15 15 0 0 1 30 0 v14 z`} fill="#231f2e" stroke={INK} strokeWidth={2.5} />
      <path d={`M${doorX - 15} ${Y + H - 16} l4 5 l4 -5 l4 5 l4 -5 l4 5 l4 -5 l4 5`} fill="none" stroke="#b3a99c" strokeWidth={2} />
      <circle cx={doorX - 22} cy={Y + H - 26} r={3} fill="#ffe27a" className="lamp" /><path d={`M${doorX - 22} ${Y + H - 23} v20`} stroke="#8a5a2b" strokeWidth={2.5} />
      <circle cx={X + W / 2 + 22} cy={Y + 26} r={13} fill="rgba(255,250,240,0.9)" stroke={INK} strokeWidth={2} />
      {PLACE_ICON[p.id] ? <IconShapes name={PLACE_ICON[p.id]} x={X + W / 2 + 12} y={Y + 16} size={20} /> : <text x={X + W / 2 + 22} y={Y + 32} fontSize={17} textAnchor="middle">{p.emoji}</text>}
      <Label x={X + W / 2} y={Y + H + 1} text={p.name} />
      {badge && <Badge x={X + W - 6} y={Y + 6} text={badge} />}
    </g>
  );
}

function Label({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 5.6 + 10;
  return (
    <g className="house-label" pointerEvents="none">
      <rect x={x - w / 2} y={y} width={w} height={13} rx={6} fill="rgba(255,250,240,0.92)" stroke="#2d2a3e" strokeWidth={1.2} />
      <text x={x} y={y + 10} fontSize={9.5} fontWeight={800} textAnchor="middle" fill="#2d2a3e">{text}</text>
    </g>
  );
}

function Badge({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.max(18, text.length * 7 + 8);
  return (
    <g className="house-badge" pointerEvents="none">
      <rect x={x - w / 2} y={y - 9} width={w} height={18} rx={9} fill="#e8413c" stroke="#2d2a3e" strokeWidth={2} />
      <text x={x} y={y + 4.5} fontSize={11} fontWeight={900} textAnchor="middle" fill="#fff">{text}</text>
    </g>
  );
}
