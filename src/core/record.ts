import { hashString, positionKey } from './position';
import { play } from './rules';
import { fromFEN, STANDARD_FEN } from './setup';
import type { Action, GameState, PlayerId } from './types';
import { applySetup } from './modifiers';
import { cardRules } from './cards';
import { MODE_SETUP } from './modes';
import { MODE_SETUP_2, type ModeExtra } from './modes2';
import { rngInt } from './rng';
import { battleStart, type BattleKind } from './variants';

/**
 * A game is fully described by its setup, seed and action list (docs/04 section 1).
 */
export interface GameRecord {
  version: 1;
  id: string;
  setup: ({ kind: 'fen'; fen: string; mode: string } | { kind: 'battle'; battle: BattleKind; mode: string; /** Hexagon without its six middle squares (games from 2026-11-19 on). */ hole?: boolean }) & {
    /** Party match extras: public modifiers and each player's secret mission ('?' when hidden from you). */
    /** Mode setup choices: who has the boss, drafted armies, survival position. */
    extra?: ModeExtra;
    party?: { modifiers: Partial<Record<PlayerId, string[]>>; missions: Partial<Record<PlayerId, string>>; gate: Partial<Record<PlayerId, number>>; cards?: Partial<Record<PlayerId, string[]>>; /** Turns the other player gets to undo this player's shown mission. */ defence?: Partial<Record<PlayerId, number>>; /** Open bonus objectives, checked at the end (docs/02 s5). */ bonus?: Partial<Record<PlayerId, string>> };
  };
  seed: number;
  actions: Action[];
  meta: {
    startedAt: number;
    players: Record<string, string>;
    result?: GameState['result'];
    san?: string[];
  };
}

export function newRecord(seed: number, players: Record<string, string>, fen = STANDARD_FEN, mode = 'standard'): GameRecord {
  return {
    version: 1,
    id: `${Date.now().toString(36)}-${(seed >>> 0).toString(36)}`,
    setup: { kind: 'fen', fen, mode },
    seed,
    actions: [],
    meta: { startedAt: Date.now(), players },
  };
}

export function initialState(rec: GameRecord): GameState {
  let s: GameState = rec.setup.kind === 'battle' ? battleStart(rec.setup.battle, rec.setup.mode, rec.seed, !!rec.setup.hole) : { ...fromFEN(rec.setup.fen, rec.seed), mode: rec.setup.mode };
  // Deterministic picks for setup randomness (shuffled back rank, missing pawn…).
  let r = rec.seed ^ 0x5bd1e995;
  const pick = (n: number) => { const [v, next] = rngInt(r, n); r = next; return v; };
  const modeSetup = MODE_SETUP[s.mode];
  if (modeSetup) s = modeSetup(s, pick);
  const setup2 = MODE_SETUP_2[s.mode];
  if (setup2) s = setup2(s, pick, rec.setup.extra ?? {});
  if (rec.setup.party) s = applySetup(s, rec.setup.party.modifiers, pick);
  // Power cards in each hand become rule modules (played with a buff action, then burned).
  if (rec.setup.party?.cards) s = { ...s, rules: [...(s.rules ?? []), ...cardRules(rec.setup.party.cards)] };
  return s;
}

export function newBattleRecord(seed: number, players: Record<string, string>, battle: BattleKind, mode = 'battle'): GameRecord {
  return { ...newRecord(seed, players), setup: battle === 'tri' ? { kind: 'battle', battle, mode, hole: true } : { kind: 'battle', battle, mode } };
}

/** Every state from the start to the end of the record. */
export function replay(rec: GameRecord): GameState[] {
  const states = [initialState(rec)];
  for (const a of rec.actions) states.push(play(states[states.length - 1], a));
  return states;
}

export function stateHash(s: GameState): string {
  return hashString(positionKey(s) + JSON.stringify(s.result) + s.rng);
}
