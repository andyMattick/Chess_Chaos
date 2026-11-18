import { chooseMove } from './strength';
import { rankMoves } from './search';
import { botById, type BookLine } from '../content/bots';
import { reviewGame, type ReviewResult } from '../systems/review';
import { analyzeGame, type Analysis } from '../systems/analysis';
import type { GameRecord } from '../core/record';
import type { GameState, MoveAction, PlayerId } from '../core/types';

/**
 * Everything slow runs here, off the main thread: bot moves, hint rankings
 * for the training alerts, and post-game reviews.
 */
export type AIRequest =
  | { id: number; kind: 'move'; state: GameState; rating: number; botId?: string; book?: CustomBook }
  | { id: number; kind: 'rank'; state: GameState; depth: number }
  | { id: number; kind: 'review'; record: GameRecord; player: PlayerId }
  | { id: number; kind: 'analyze'; record: GameRecord };

export interface RankedMoveOut { move: MoveAction; score: number }

export type AIResponse =
  | { id: number; kind: 'move'; move: MoveAction | null; source?: string; error?: string }
  | { id: number; kind: 'rank'; ranked: RankedMoveOut[]; error?: string }
  | { id: number; kind: 'review'; review: ReviewResult | null; error?: string }
  | { id: number; kind: 'analyze'; analysis: Analysis | null; error?: string };

/** An opening book sent with the request (nemesis bots live in the player's save, not in content). */
export interface CustomBook { id: string; asWhite: BookLine[]; asBlack: BookLine[] }
const books = new Map<string, CustomBook>();
function customBook(b: CustomBook): CustomBook {
  // Keep one array per id so the compiled book is cached between moves.
  // Learning bots change their weights, so compare those too.
  const sig = (x: CustomBook) => `${x.asWhite.length}/${x.asBlack.length}/${[...x.asWhite, ...x.asBlack].reduce((a, l) => a + (l.weight ?? 1), 0)}`;
  const hit = books.get(b.id);
  if (hit && sig(hit) === sig(b)) return hit;
  books.set(b.id, b);
  return b;
}

export function handle(req: AIRequest): AIResponse {
  try {
    switch (req.kind) {
      case 'move': {
        const bot = req.book ? customBook(req.book) : req.botId ? botById(req.botId) : undefined;
        const c = chooseMove(req.state, { bot, rating: req.rating });
        return { id: req.id, kind: 'move', move: c?.move ?? null, source: c?.source };
      }
      case 'rank':
        return { id: req.id, kind: 'rank', ranked: rankMoves(req.state, req.depth, true, 2500) };
      case 'review':
        return { id: req.id, kind: 'review', review: reviewGame(req.record, req.player) };
      case 'analyze':
        return { id: req.id, kind: 'analyze', analysis: analyzeGame(req.record) };
    }
  } catch (e) {
    const error = String(e);
    if (req.kind === 'move') return { id: req.id, kind: 'move', move: null, error };
    if (req.kind === 'rank') return { id: req.id, kind: 'rank', ranked: [], error };
    if (req.kind === 'analyze') return { id: req.id, kind: 'analyze', analysis: null, error };
    return { id: req.id, kind: 'review', review: null, error };
  }
}

// Only wire up messaging when actually running inside a worker. (Module
// workers have no importScripts, so test for the worker scope itself.)
const g = globalThis as unknown as {
  WorkerGlobalScope?: new () => unknown;
  onmessage: ((e: MessageEvent<AIRequest>) => void) | null;
  postMessage: (d: AIResponse) => void;
};
if (typeof window === 'undefined' && typeof g.WorkerGlobalScope !== 'undefined' && globalThis instanceof g.WorkerGlobalScope) {
  g.onmessage = (e) => g.postMessage(handle(e.data));
}
