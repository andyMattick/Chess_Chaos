import { chooseMove } from './strength';
import { rankMoves } from './search';
import { botById } from '../content/bots';
import { reviewGame, type ReviewResult } from '../systems/review';
import type { GameRecord } from '../core/record';
import type { GameState, MoveAction, PlayerId } from '../core/types';

/**
 * Everything slow runs here, off the main thread: bot moves, hint rankings
 * for the training alerts, and post-game reviews.
 */
export type AIRequest =
  | { id: number; kind: 'move'; state: GameState; rating: number; botId?: string }
  | { id: number; kind: 'rank'; state: GameState; depth: number }
  | { id: number; kind: 'review'; record: GameRecord; player: PlayerId };

export interface RankedMoveOut { move: MoveAction; score: number }

export type AIResponse =
  | { id: number; kind: 'move'; move: MoveAction | null; source?: string; error?: string }
  | { id: number; kind: 'rank'; ranked: RankedMoveOut[]; error?: string }
  | { id: number; kind: 'review'; review: ReviewResult | null; error?: string };

export function handle(req: AIRequest): AIResponse {
  try {
    switch (req.kind) {
      case 'move': {
        const bot = req.botId ? botById(req.botId) : undefined;
        const c = chooseMove(req.state, { bot, rating: req.rating });
        return { id: req.id, kind: 'move', move: c?.move ?? null, source: c?.source };
      }
      case 'rank':
        return { id: req.id, kind: 'rank', ranked: rankMoves(req.state, req.depth, true, 2500) };
      case 'review':
        return { id: req.id, kind: 'review', review: reviewGame(req.record, req.player) };
    }
  } catch (e) {
    const error = String(e);
    if (req.kind === 'move') return { id: req.id, kind: 'move', move: null, error };
    if (req.kind === 'rank') return { id: req.id, kind: 'rank', ranked: [], error };
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
