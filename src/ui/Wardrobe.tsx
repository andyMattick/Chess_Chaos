import { useState } from 'react';
import { skinFor, type SkinChoice, type SkinId } from '../content/cosmetics';
import { update } from '../storage/storage';
import { LANDSCAPES, squareDoodle } from './landscapes';
import { Character, SKINS } from './skins';
import { useSave } from './store';

const TYPES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const SIDES = [
  { seat: 'p1', label: 'White army' },
  { seat: 'p2', label: 'Black army' },
];

/**
 * Wardrobe: dress each army in a skin, then swap single pieces to any other
 * skin. Also picks the landscape the board is set in.
 */
export function Wardrobe({ back }: { back: () => void }) {
  const save = useSave();
  const skins = save.settings.skins;
  const [editing, setEditing] = useState<{ seat: string; type: string } | null>(null);

  const setSkins = (next: SkinChoice) => update((d) => ({ ...d, settings: { ...d.settings, skins: next } }));
  const setArmy = (seat: string, id: SkinId) => setSkins({ ...skins, armies: { ...skins.armies, [seat]: id }, pieces: { ...skins.pieces, [seat]: {} } });
  const setPiece = (seat: string, type: string, id: SkinId | null) => {
    const mine = { ...(skins.pieces[seat] ?? {}) };
    if (id === null || id === skins.armies[seat]) delete mine[type]; else mine[type] = id;
    setSkins({ ...skins, pieces: { ...skins.pieces, [seat]: mine } });
  };

  return (
    <div className="panel wide taped">
      <h2>Wardrobe <span className="scribble">dress 'em up</span></h2>

      {SIDES.map(({ seat, label }) => (
        <section key={seat} className="army">
          <h3>{label}</h3>
          <div className="skin-row">
            {SKINS.map((s) => (
              <button key={s.id} className={`skin-card ${skins.armies[seat] === s.id ? 'on' : ''}`} onClick={() => setArmy(seat, s.id)} title={s.blurb}>
                <svg viewBox="0 0 200 100">
                  <g transform="translate(0 0)"><Character skin={s.id} type="king" owner={seat} seed={4} /></g>
                  <g transform="translate(100 10) scale(0.9)"><Character skin={s.id} type="pawn" owner={seat} seed={8} /></g>
                </svg>
                <b>{s.name}</b>
              </button>
            ))}
          </div>
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
                      {SKINS.map((s) => (
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

      <label className="toggle">
        <input type="checkbox" checked={skins.badges} onChange={(e) => setSkins({ ...skins, badges: e.target.checked })} />
        Show little piece badges (helps you tell who's who)
      </label>

      <h3>Landscape</h3>
      <div className="land-row">
        {LANDSCAPES.map((l) => (
          <button key={l.id} className={`land-card ${save.settings.landscape === l.id ? 'on' : ''}`} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, landscape: l.id } }))}>
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
          </button>
        ))}
      </div>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}
