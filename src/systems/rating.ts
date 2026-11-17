/**
 * Elo ratings (docs/02 section 1). Start 600; K = 32 for the first 30 games, then 16.
 */
export const START_RATING = 600;

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

/**
 * New rating after one game. score: 1 win, 0.5 draw, 0 loss.
 * `weight` scales the change (a mission win counts half, docs/08 Q1).
 */
export function updateRating(rating: number, opponent: number, score: number, gamesPlayed: number, weight = 1): number {
  const k = gamesPlayed < 30 ? 32 : 16;
  return Math.round(rating + k * weight * (score - expectedScore(rating, opponent)));
}
