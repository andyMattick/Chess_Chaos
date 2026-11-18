import type { GameRecord } from '../core/record';
import type { GameState, MoveAction, PlayerId } from '../core/types';
import type { ReviewResult } from '../systems/review';
import type { AIRequest, AIResponse, RankedMoveOut } from './worker';

/**
 * Runs the AI in a Web Worker so the board never freezes. If a worker cannot
 * be started, falls back to running on the main thread after a paint.
 */
let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, (r: AIResponse | null) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<AIResponse>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
    worker.onerror = () => {
      worker = null;
      const waiting = [...pending.values()];
      pending.clear();
      waiting.forEach((resolve) => resolve(null));
    };
  } catch {
    worker = null;
  }
  return worker;
}

type Req = AIRequest extends infer R ? (R extends AIRequest ? Omit<R, 'id'> : never) : never;

async function run(body: Req): Promise<AIResponse> {
  const req = { ...body, id: nextId++ } as AIRequest;
  const w = getWorker();
  if (w) {
    const res = await new Promise<AIResponse | null>((resolve) => {
      pending.set(req.id, resolve);
      w.postMessage(req);
    });
    if (res) return res;
  }
  await new Promise((r) => setTimeout(r, 30));
  const { handle } = await import('./worker');
  return handle(req);
}

export async function requestMove(state: GameState, rating: number, botId?: string, minDelayMs = 450): Promise<MoveAction | null> {
  const started = Date.now();
  const res = await run({ kind: 'move', state, rating, botId });
  const wait = minDelayMs - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (res.error) console.warn('AI error', res.error);
  return res.kind === 'move' ? res.move : null;
}

export async function requestRanking(state: GameState, depth = 2): Promise<RankedMoveOut[]> {
  const res = await run({ kind: 'rank', state, depth });
  return res.kind === 'rank' ? res.ranked : [];
}

export async function requestReview(record: GameRecord, player: PlayerId): Promise<ReviewResult | null> {
  const res = await run({ kind: 'review', record, player });
  return res.kind === 'review' ? res.review : null;
}
