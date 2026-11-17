import { hashString, positionKey } from './position';
import { play } from './rules';
import { fromFEN, STANDARD_FEN } from './setup';
import type { Action, GameState } from './types';

/**
 * A game is fully described by its setup, seed and action list (docs/04 section 1).
 */
export interface GameRecord {
  version: 1;
  id: string;
  setup: { kind: 'fen'; fen: string; mode: string };
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
  const s = fromFEN(rec.setup.fen, rec.seed);
  return { ...s, mode: rec.setup.mode };
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
