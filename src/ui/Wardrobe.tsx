import { useState } from 'react';
import { LANDSCAPE_PRICES, SKIN_PRICES, skinFor, type LandscapeId, type SkinChoice, type SkinId } from '../content/cosmetics';
import { activeProfile, updateProfile } from '../storage/storage';
import { LANDSCAPES, squareDoodle } from './landscapes';
import { Character, SKINS, skinInfo } from './skins';
import { sfx } from './sound';
import { useSave } from './store';

const TYPES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const SIDES = [
  { seat: 'p1', label: 'White army' },
  { seat: 'p2', label: 'Black army' },
];

/**
 * Wardrobe and shop: spend coins on skins and landscapes, dress each army,
 * and swap single pieces to any skin you own.
 */
export function Wardrobe({ back }: { back: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [tab, setTab] = useState<string>('p1');
  const [editing, setEditing] = useState<{ seat: string; type: string } | null>(null);
  const [buying, setBuying] = useState<{ kind: 'skin'; id: SkinId } | { kind: 'land'; id: LandscapeId } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  if (!p) return null;
  const skins = p.look.skins;
  const owns = (id: SkinId) => p.owned.skins.includes(id);
  const ownsLand = (id: LandscapeId) => p.owned.landscapes.includes(id);

  const setSkins = (next: SkinChoice) => updateProfile((x) => ({ ...x, look: { ...x.look, skins: next } }));
  const setArmy = (seat: string, id: SkinId) => setSkins({ ...skins, armies: { ...skins.armies, [seat]: id }, pieces: { ...skins.pieces, [seat]: {} } });
  const setPiece = (seat: string, type: string, id: SkinId) => {
    const mine = { ...(skins.pieces[seat] ?? {}) };
    if (id === skins.armies[seat]) delete mine[type]; else mine[type] = id;
    setSkins({ ...skins, pieces: { ...skins.pieces, [seat]: mine } });
  };

  // Base skins first, then any collection skins you have won.
  const allIds: SkinId[] = [...SKINS.map((x) => x.id), ...p.owned.skins.filter((id) => !SKINS.some((b) => b.id === id))];
  const priceOf = (id: SkinId) => (SKIN_PRICES as Record<string, number>)[id] ?? 0;
  const price = buying ? (buying.kind === 'skin' ? priceOf(buying.id) : LANDSCAPE_PRICES[buying.id]) : 0;
  const buy = () => {
    if (!buying || p.coins < price) return;
    updateProfile((x) => ({
      ...x,
      coins: x.coins - price,
      owned: buying.kind === 'skin' ? { ...x.owned, skins: [...x.owned.skins, buying.id] } : { ...x.owned, landscapes: [...x.owned.landscapes, buying.id] },
      look: buying.kind === 'land' ? { ...x.look, landscape: buying.id } : x.look,
    }));
    sfx.promote();
    setFlash(buying.kind === 'skin' ? `${skinInfo(buying.id).name} unlocked!` : 'New landscape unlocked!');
    setTimeout(() => setFlash(null), 2200);
    setBuying(null);
  };

  return (
    <div className="panel wide taped">
      <div className="wardrobe-head">
        <h2>Wardrobe <span className="scribble">dress 'em up</span></h2>
        <div className="wallet">🪙 {p.coins}</div>
      </div>
      <p className="muted small">Win games, finish goals and find tricks to earn coins. Every game pays something.</p>

      <div className="tabs" role="tablist">
        {SIDES.map(({ seat, label }) => <button key={seat} role="tab" aria-selected={tab === seat} className={`tab ${tab === seat ? 'on' : ''}`} onClick={() => setTab(seat)}>{label}</button>)}
        <button role="tab" aria-selected={tab === 'land'} className={`tab ${tab === 'land' ? 'on' : ''}`} onClick={() => setTab('land')}>Landscape</button>
      </div>
      {SIDES.filter(({ seat }) => seat === tab).map(({ seat, label }) => (
        <section key={seat} className="army">
          <h3>{label}{seat === 'p1' && <span className="scribble">this is your army online</span>}</h3>
          <div className="skin-row">
            {allIds.map((id) => ({ id, ...skinInfo(id) })).map((s) => {
              const have = owns(s.id);
              return (
                <button
                  key={s.id}
                  className={`skin-card ${skins.armies[seat] === s.id ? 'on' : ''} ${have ? '' : 'locked'}`}
                  onClick={() => (have ? setArmy(seat, s.id) : setBuying({ kind: 'skin', id: s.id }))}
                  title={s.blurb}
                >
                  <svg viewBox="0 0 200 100">
                    <Character skin={s.id} type="king" owner={seat} seed={4} />
                    <g transform="translate(100 10) scale(0.9)"><Character skin={s.id} type="pawn" owner={seat} seed={8} /></g>
                  </svg>
                  <b>{s.name}</b>
                  {!have && <span className="price">🪙 {priceOf(s.id)}</span>}
                </button>
              );
            })}
          </div>
          <p className="muted small">🏆 More skins: turn in card sets in 🃏 My cards → Collections.</p>
          <p className="muted small">Tap a piece to give it its own look:</p>
          <div className="piece-row">
            {TYPES.map((t) => {
              const sk = skinFor(skins, seat, t);
              const custom = !!skins.pieces[seat]?.[t];
              const open = editing?.seat === seat && editing.type === t;
              return (
                <div key={t} className="piece-slot">
                  <button className={`piece-btn ${custom ? 'custom' : ''} ${open ? 'on' : ''}`} onClick={() => setEditing(open ? null : { seat, type: t })} aria-label={`${label} ${t}`}>
                    <svg viewBox="0 0 100 100"><Character skin={sk} type={t} owner={seat} seed={t.length} badge={skins.badges && sk !== 'classic'} /></svg>
                  </button>
                  {open && (
                    <div className="mini-picker">
                      {allIds.filter((id) => owns(id)).map((id) => ({ id, ...skinInfo(id) })).map((s) => (
                        <button key={s.id} className={sk === s.id ? 'on' : ''} onClick={() => { setPiece(seat, t, s.id); setEditing(null); }} aria-label={s.name}>
                          <svg viewBox="0 0 100 100"><Character skin={s.id} type={t} owner={seat} seed={2} /></svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {tab !== 'land' && (
        <label className="toggle">
          <input type="checkbox" checked={skins.badges} onChange={(e) => setSkins({ ...skins, badges: e.target.checked })} />
          Show little piece badges (helps you tell who's who)
        </label>
      )}

      {tab === 'land' && <div className="land-row">
        {LANDSCAPES.map((l) => {
          const have = ownsLand(l.id);
          return (
            <button
              key={l.id}
              className={`land-card ${p.look.landscape === l.id ? 'on' : ''} ${have ? '' : 'locked'}`}
              onClick={() => (have ? updateProfile((x) => ({ ...x, look: { ...x.look, landscape: l.id } })) : setBuying({ kind: 'land', id: l.id }))}
            >
              <svg viewBox="0 0 300 300" style={{ background: l.frame }}>
                {Array.from({ length: 9 }, (_, i) => {
                  const light = (Math.floor(i / 3) + (i % 3)) % 2 === 0;
                  return (
                    <g key={i} transform={`translate(${(i % 3) * 100} ${Math.floor(i / 3) * 100})`}>
                      <rect width={101} height={101} fill={light ? l.light : l.dark} />
                      {squareDoodle(l, i * 7 + 3, light)}
                    </g>
                  );
                })}
              </svg>
              <b>{l.emoji} {l.name}</b>
              {!have && <span className="price">🪙 {LANDSCAPE_PRICES[l.id]}</span>}
            </button>
          );
        })}
      </div>}
      <button className="btn" onClick={back}>← Home</button>

      {buying && (
        <div className="shop-modal" role="dialog" aria-label="Buy">
          <div className="shop-card">
            {buying.kind === 'skin' ? (
              <svg viewBox="0 0 300 100" className="shop-preview">
                {['king', 'queen', 'knight'].map((t, i) => <g key={t} transform={`translate(${i * 100} 0)`}><Character skin={buying.id} type={t} owner="p1" seed={i + 3} /></g>)}
              </svg>
            ) : (
              <div className="shop-land">{LANDSCAPES.find((l) => l.id === buying.id)?.emoji}</div>
            )}
            <h3>{buying.kind === 'skin' ? skinInfo(buying.id).name : LANDSCAPES.find((l) => l.id === buying.id)?.name}</h3>
            {buying.kind === 'skin' && <p>{skinInfo(buying.id).blurb}</p>}
            <p className="price big">🪙 {price}</p>
            {p.coins >= price ? (
              <div className="row center">
                <button className="btn primary" onClick={buy}>Buy it!</button>
                <button className="btn" onClick={() => setBuying(null)}>Not now</button>
              </div>
            ) : (
              <>
                <p className="muted">You need {price - p.coins} more coins. Go win some games!</p>
                <button className="btn" onClick={() => setBuying(null)}>OK</button>
              </>
            )}
          </div>
        </div>
      )}
      {flash && <div className="toast">🎉 {flash}</div>}
    </div>
  );
}
