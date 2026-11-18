/**
 * Training alerts (docs/03, Alerts). One alert is active for a whole training
 * game. `trains` lists the miss-map entries the alert helps with, so the
 * alert picker can aim at what the player keeps missing.
 */
export type AlertId =
  | 'ALERT-01' | 'ALERT-02' | 'ALERT-03' | 'ALERT-04' | 'ALERT-05'
  | 'ALERT-06' | 'ALERT-07' | 'ALERT-08' | 'ALERT-09' | 'ALERT-10';

export interface AlertDef {
  id: AlertId;
  name: string;
  emoji: string;
  /** Shown on the reveal card. Short, kid-friendly. */
  blurb: string;
  trains: string[];
  /** Needs the AI search (runs in the worker). */
  needsSearch: boolean;
}

export const ALERTS: AlertDef[] = [
  { id: 'ALERT-01', name: 'Danger squares', emoji: '🔥', blurb: 'Squares the other side can hit glow red. Don\'t park there!', trains: ['hanging', 'threat'], needsSearch: false },
  { id: 'ALERT-02', name: 'Hanging alarm', emoji: '🚨', blurb: 'Your pieces that can be taken for free will wobble.', trains: ['hanging'], needsSearch: false },
  { id: 'ALERT-03', name: 'Best piece glow', emoji: '✨', blurb: 'The piece with the best move glows. You find where it goes.', trains: ['fork', 'pin', 'skewer', 'discovered', 'free-piece', 'mate'], needsSearch: true },
  { id: 'ALERT-04', name: 'Best square glow', emoji: '🎯', blurb: 'The best square glows. You find which piece should go there.', trains: ['fork', 'skewer', 'free-piece', 'mate'], needsSearch: true },
  { id: 'ALERT-05', name: 'Pick from three', emoji: '🎲', blurb: 'Three arrows: one great, one okay, one oops. Pick one!', trains: ['hanging', 'free-piece'], needsSearch: true },
  { id: 'ALERT-06', name: 'Hot and cold', emoji: '🌡️', blurb: 'Pick up a piece: hot squares are good moves, cold ones are bad.', trains: ['hanging', 'free-piece', 'fork'], needsSearch: true },
  { id: 'ALERT-07', name: 'Name the idea', emoji: '💡', blurb: 'When a trick is on the board, we tell you its name. You find it.', trains: ['fork', 'pin', 'skewer', 'discovered', 'free-piece', 'mate'], needsSearch: false },
  { id: 'ALERT-08', name: 'What does that move want?', emoji: '🕵️', blurb: 'When the other side threatens something, tap what they\'re after first.', trains: ['threat'], needsSearch: false },
  { id: 'ALERT-09', name: 'Second look', emoji: '👀', blurb: 'If your move drops a piece, we\'ll ask you to look again.', trains: ['hanging', 'threat'], needsSearch: true },
  { id: 'ALERT-10', name: 'Count the fight', emoji: '⚔️', blurb: 'See how many pieces attack and defend each piece.', trains: ['hanging', 'threat'], needsSearch: false },
];

export function alertById(id: string): AlertDef | undefined {
  return ALERTS.find((a) => a.id === id);
}
