/**
 * Bot-vs-bot playtest of full Party matches: every mode in the party deck with
 * the buffs, handicaps and secret missions a real Party match deals.
 *
 *   bun scripts/simulate-party.ts [gamesPerMode=8] [ratingA=800] [ratingB=1200] [modes=all]
 *
 * The weaker bot plays at ratingA (the underdog, gets buffs), the stronger at
 * ratingB (gets handicaps when the gap is big). Reports wins for each, draws,
 * missions completed, stalls and crashes. Plain engine code, no AI service.
 */
import { newRecord, initialState } from '../src/core/record';
import { play } from '../src/core/rules';
import { chooseMove } from '../src/ai/strength';
import { PARTY_DECK, setupParty, refereeMission, undoingMoves } from '../src/systems/party';
import { strengthFor } from '../src/ai/strength';
import type { Action, GameState, PlayerId } from '../src/core/types';

const GAMES = Number(process.argv[2] ?? 8);
const RA = Number(process.argv[3] ?? 800);
const RB = Number(process.argv[4] ?? 1200);
const ONLY = process.argv[5]?.split(',');
const CAP = 300;

function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) ^ (x + 0x6d2b79f5)) >>> 0) / 4294967296;
}

interface Out { winner: 'under' | 'fav' | 'draw' | 'stall' | 'crash'; reason: string; plies: number; mods: string[]; missions: string[] }

const stats = { reveal: 0, off: 0, win: 0 };
const byId: Record<string, number> = {};

function playOne(mode: string, seed: number): Out {
  const rand = seeded(seed * 104729);
  // Swap colours every other game so the underdog plays both sides.
  const under: PlayerId = seed % 2 ? 'p1' : 'p2';
  const fav: PlayerId = under === 'p1' ? 'p2' : 'p1';
  const rating = { [under]: RA, [fav]: RB } as Record<'p1' | 'p2', number>;
  const party = setupParty({ mode, online: false, players: { p1: { rating: rating.p1, bot: true }, p2: { rating: rating.p2, bot: true } } }, rand);
  const rec = newRecord(seed, { p1: 'A', p2: 'B' }, undefined, mode);
  if (mode === 'boss') rec.setup = { ...rec.setup, extra: { boss: fav } };
  rec.setup = { ...rec.setup, party };
  let s = initialState(rec);
  const states: GameState[] = [s];
  const actions: Action[] = [];
  const push = (a: Action) => { s = play(s, a); actions.push(a); states.push(s); };
  while (!s.result && s.ply < CAP) {
    if (mode === 'hidden-queen' && (s.modeData?.hiddenQueen as Record<string, unknown> | undefined)?.[s.turn] === undefined) {
      const pawns = s.pieces.filter((x) => x.owner === s.turn && x.type === 'pawn' && x.at >= 0);
      if (pawns.length) { push({ t: 'buff', by: s.turn, id: 'MODE-19', piece: pawns[Math.floor(rand() * pawns.length)].id }); continue; }
    }
    const r = rating[s.turn as 'p1' | 'p2'];
    // Bots try to undo a shown mission (weaker bots sometimes miss it, like in the app).
    const undo = rand() < strengthFor(r).weakChance ? [] : undoingMoves(s, s.turn);
    const c = chooseMove(s, { rating: r, random: rand, only: undo.length ? undo : undefined });
    if (!c) break;
    push(c.move);
    for (let i = 0; i < 4 && !s.result; i++) {
      const done = refereeMission(states, actions, party);
      if (!done) break;
      push(done);
      if (done.t === 'mission') { stats[done.stage ?? 'win']++; byId[`${done.id}:${done.stage}`] = (byId[`${done.id}:${done.stage}`] ?? 0) + 1; }
    }
  }
  const w = s.result?.winners ?? [];
  return {
    winner: !s.result ? 'stall' : !w.length ? 'draw' : w[0] === under ? 'under' : 'fav',
    reason: s.result?.reason ?? 'cap', plies: s.ply,
    mods: [...(party.modifiers.p1 ?? []), ...(party.modifiers.p2 ?? [])],
    missions: [party.missions.p1!, party.missions.p2!],
  };
}

const out: Record<string, unknown> = {};
for (const mode of [...new Set(PARTY_DECK)]) {
  if (ONLY && !ONLY.includes(mode)) continue;
  const games: Out[] = [];
  for (let i = 0; i < GAMES; i++) {
    try { games.push(playOne(mode, 2000 + i)); } catch (e) { games.push({ winner: 'crash', reason: String(e).slice(0, 100), plies: 0, mods: [], missions: [] }); }
  }
  const count = (w: Out['winner']) => games.filter((g) => g.winner === w).length;
  const reasons: Record<string, number> = {};
  for (const g of games) reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
  out[mode] = { underdog: count('under'), favourite: count('fav'), draw: count('draw'), stall: count('stall'), crash: count('crash'),
    avgMoves: Math.round(games.reduce((a, g) => a + g.plies, 0) / games.length / 2), reasons, missions: { ...stats } };
  stats.reveal = 0; stats.off = 0; stats.win = 0;
  console.error(mode, JSON.stringify(out[mode]));
}
console.log(JSON.stringify(out, null, 2));
console.error("byId", JSON.stringify(byId));
