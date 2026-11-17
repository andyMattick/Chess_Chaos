import type { GameState, MoveAction } from '../core/types';
import type { AIRequest, AIResponse } from './worker';

/**
 * Runs the AI in a Web Worker so the board never freezes. If a worker cannot
 * be started, falls back to running on the main thread after a paint.
 */
let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, (r: AIResponse) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<AIResponse>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
    worker.onerror = () => {
      // Worker failed to load: answer everything pending on the main thread.
      worker = null;
      const waiting = [...pending.entries()];
      pending.clear();
      waiting.forEach(([, resolve]) => resolve({ id: -1, move: null, error: 'worker-failed' }));
    };
  } catch {
    worker = null;
  }
  return worker;
}

async function inline(req: AIRequest): Promise<AIResponse> {
  await new Promise((r) => setTimeout(r, 30));
  const { handle } = await import('./worker');
  return handle(req);
}

export async function requestMove(state: GameState, rating: number, botId?: string, minDelayMs = 450): Promise<MoveAction | null> {
  const started = Date.now();
  const req: AIRequest = { id: nextId++, state, rating, botId };
  const w = getWorker();
  let res: AIResponse;
  if (w) {
    res = await new Promise<AIResponse>((resolve) => {
      pending.set(req.id, resolve);
      w.postMessage(req);
    });
    if (res.error === 'worker-failed') res = await inline(req);
  } else {
    res = await inline(req);
  }
  const wait = minDelayMs - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (res.error) console.warn('AI error', res.error);
  return res.move;
}
