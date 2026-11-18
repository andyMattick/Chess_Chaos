import type { PlayerId } from '../core/types';

/**
 * Endgame survival (MODE-12): hold out for 20 moves from a tricky endgame
 * against a strong bot. A draw counts as holding out.
 */
export interface SurvivalLevel { id: string; name: string; emoji: string; fen: string; survivor: PlayerId; tip: string }

export const SURVIVAL: SurvivalLevel[] = [
  { id: 'SV-1', name: 'Stop the pawn', emoji: '🧱', fen: '8/8/8/8/4k3/8/4P3/4K3 w - - 0 1', survivor: 'p2',
    tip: 'Keep your king right in front of the pawn. Don\'t let their king get ahead of it.' },
  { id: 'SV-2', name: 'Rook duel', emoji: '🏰', fen: '4k3/r7/8/8/8/8/8/R3K3 w - - 0 1', survivor: 'p1',
    tip: 'Keep your rook safe and your king close to it. Trading rooks is a draw!' },
  { id: 'SV-3', name: 'Queen chase', emoji: '👑', fen: 'q3k3/8/8/8/8/8/8/3QK3 w - - 0 1', survivor: 'p1',
    tip: 'Watch for checks that win your queen. Trading queens is a draw!' },
  { id: 'SV-4', name: 'Knight vs rook', emoji: '🐴', fen: '8/8/3k4/8/3r4/8/3N4/3K4 w - - 0 1', survivor: 'p1',
    tip: 'Keep the knight next to your king so it can\'t be trapped.' },
  { id: 'SV-5', name: 'Pawn wall', emoji: '🐌', fen: '4k3/8/8/2p1p3/2P1P3/8/8/4K3 w - - 0 1', survivor: 'p1',
    tip: 'Guard your pawns with your king. Don\'t let their king sneak round.' },
];
