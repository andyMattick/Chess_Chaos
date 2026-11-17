import { positionKey } from '../core/position';
import { play } from '../core/rules';
import { parseSAN } from '../core/san';
import { standardStart } from '../core/setup';
import type { GameState, MoveAction } from '../core/types';
import type { BookLine } from '../content/bots';

/** Position key to weighted moves. Transpositions are handled because keys are positions. */
export type Book = Map<string, { move: MoveAction; weight: number }[]>;

const cache = new WeakMap<BookLine[], Book>();

export function compileBook(lines: BookLine[]): Book {
  const hit = cache.get(lines);
  if (hit) return hit;
  const book: Book = new Map();
  for (const { line, weight = 1 } of lines) {
    let s = standardStart();
    for (const san of line.split(/\s+/).filter(Boolean)) {
      const m = parseSAN(s, san);
      if (!m) throw new Error(`Illegal book move "${san}" in line "${line}"`);
      const key = positionKey(s);
      const list = book.get(key) ?? [];
      const existing = list.find((e) => e.move.piece === m.piece && e.move.to === m.to && e.move.promo === m.promo);
      if (existing) existing.weight += weight; else list.push({ move: m, weight });
      book.set(key, list);
      s = play(s, m);
      if (s.result) break;
    }
  }
  cache.set(lines, book);
  return book;
}

/** A book move for this position, chosen by weight with r in [0, 1). */
export function bookMove(book: Book, s: GameState, r: number): MoveAction | undefined {
  const list = book.get(positionKey(s));
  if (!list?.length) return undefined;
  const total = list.reduce((a, e) => a + e.weight, 0);
  let x = r * total;
  for (const e of list) {
    if ((x -= e.weight) < 0) return e.move;
  }
  return list[list.length - 1].move;
}
