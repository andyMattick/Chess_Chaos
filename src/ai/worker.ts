import { chooseMove } from './strength';
import { botById } from '../content/bots';
import type { GameState } from '../core/types';

export interface AIRequest { id: number; state: GameState; rating: number; botId?: string }
export interface AIResponse { id: number; move: import('../core/types').MoveAction | null; source?: string; error?: string }

export function handle(req: AIRequest): AIResponse {
  try {
    const bot = req.botId ? botById(req.botId) : undefined;
    const c = chooseMove(req.state, { bot, rating: req.rating });
    return { id: req.id, move: c?.move ?? null, source: c?.source };
  } catch (e) {
    return { id: req.id, move: null, error: String(e) };
  }
}

// Only wire up messaging when actually running inside a worker.
const ctx = globalThis as unknown as { onmessage: ((e: MessageEvent<AIRequest>) => void) | null; postMessage: (d: AIResponse) => void };
if (typeof window === 'undefined' && typeof (globalThis as { importScripts?: unknown }).importScripts === 'function') {
  ctx.onmessage = (e) => ctx.postMessage(handle(e.data));
}
