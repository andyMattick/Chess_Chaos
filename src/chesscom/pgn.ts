import { newRecord, type GameRecord } from '../core/record';
import { play } from '../core/rules';
import { parseSAN } from '../core/san';
import { fromFEN, STANDARD_FEN } from '../core/setup';
import type { EndReason, GameResult, MoveAction } from '../core/types';

/**
 * Minimal PGN reader for imported games: headers, then SAN moves. Comments
 * ({...}, including Chess.com clock tags), variations ((...)), NAGs ($n) and
 * move numbers are skipped. Returns null for games that are not standard chess.
 */
export interface ParsedPGN {
  headers: Record<string, string>;
  san: string[];
}

export function parsePGN(pgn: string): ParsedPGN {
  const headers: Record<string, string> = {};
  for (const m of pgn.matchAll(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)) headers[m[1]] = m[2];
  let body = pgn.replace(/^\[.*\]\s*$/gm, ' ');
  body = body.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  // Strip nested variations.
  let prev = '';
  while (prev !== body) { prev = body; body = body.replace(/\([^()]*\)/g, ' '); }
  const san = body
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.(\.\.)?/, '').trim())
    .filter((t) => t && !/^\$\d+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t) && !/^\d+\.+$/.test(t));
  return { headers, san };
}

const TERMINATION: [RegExp, EndReason][] = [
  [/checkmate/i, 'checkmate'],
  [/resign/i, 'resign'],
  [/time/i, 'time'],
  [/stalemate/i, 'stalemate'],
  [/repetition/i, 'draw-repetition'],
  [/insufficient/i, 'draw-material'],
  [/50/i, 'draw-50'],
  [/agree/i, 'draw-agreed'],
];

export function recordFromPGN(pgn: string, idHint = ''): GameRecord | null {
  const { headers, san } = parsePGN(pgn);
  if (headers.Variant && headers.Variant !== 'Standard') return null;
  const fen = headers.SetUp === '1' && headers.FEN ? headers.FEN : STANDARD_FEN;
  let s;
  try { s = fromFEN(fen); } catch { return null; }
  const rec = newRecord(1, { p1: headers.White ?? 'White', p2: headers.Black ?? 'Black' }, fen);
  rec.id = `cc-${idHint || headers.Link || headers.Date || Date.now()}`.replace(/[^\w-]/g, '').slice(0, 60);
  const actions: MoveAction[] = [];
  for (const t of san) {
    const m = parseSAN(s, t);
    if (!m) break; // stop at anything we cannot read; keep the moves so far
    actions.push(m);
    s = play(s, m);
    if (s.result) break;
  }
  rec.actions = actions;
  const r = headers.Result;
  const winners: GameResult['winners'] = r === '1-0' ? ['p1'] : r === '0-1' ? ['p2'] : [];
  const reason = s.result?.reason ?? TERMINATION.find(([re]) => re.test(headers.Termination ?? ''))?.[1] ?? (winners.length ? 'resign' : 'draw-agreed');
  if (r && r !== '*') rec.meta.result = s.result ?? { reason, winners };
  const date = headers.UTCDate ?? headers.Date;
  if (date) {
    const t = Date.parse(date.replace(/\./g, '-') + 'T' + (headers.UTCTime ?? '12:00:00') + 'Z');
    if (!Number.isNaN(t)) rec.meta.startedAt = t;
  }
  rec.meta.san = undefined;
  return rec;
}
