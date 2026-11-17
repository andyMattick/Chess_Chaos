# 06. Chess.com integration

## What the API is

The Chess.com Published-Data API (PubAPI) is read-only, needs no key, and returns public
data as JSON. It cannot send moves or act for a user. All play happens inside this app.

Reference: https://www.chess.com/news/view/published-data-api
Help article: https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it

Base URL: `https://api.chess.com/pub`

**Verify every endpoint and field name against the live reference page before coding.**
The shapes below are from the published documentation and should be confirmed with real responses.

## Endpoints used

| Purpose | Path | Fields of interest |
|---|---|---|
| Profile | `/player/{username}` | username, name, avatar, country, joined, last_online, title, url |
| Stats | `/player/{username}/stats` | chess_rapid, chess_blitz, chess_bullet, chess_daily (last.rating, best.rating, record), tactics, puzzle_rush |
| Archive list | `/player/{username}/games/archives` | list of monthly archive URLs |
| Monthly games | `/player/{username}/games/{YYYY}/{MM}` | games[]: pgn, time_class, rules, rated, end_time, white and black (username, rating, result), url |
| Daily puzzle | `/puzzle` | title, fen, pgn, url, image, publish_time |
| Random puzzle | `/puzzle/random` | same shape as the daily puzzle |
| Leaderboards | `/leaderboards` | lists by category |

Use only games where `rules` is `"chess"`.

## Client rules

1. **Serial requests.** Send one request at a time through a single queue. Parallel requests can be rejected with HTTP 429; on 429 wait and retry with backoff.
2. **Cache.** The documentation says data refreshes at most about every 12 hours. Cache profile, stats and archive lists for 12 hours; cache past months' games permanently (they do not change); cache the daily puzzle until the next day. Honour `ETag` and `Last-Modified` where the browser allows.
3. **Cross-origin access.** In phase 5, first run a spike that calls each endpoint from the browser on the deployed origin. If any endpoint is blocked, add one small serverless proxy function that forwards only the paths in the table above and caches responses. Do not build the proxy unless the spike shows it is needed.
4. **Errors.** 404 means no such player: show "we could not find that player". 410 means the data will never be available. Anything else: show cached data if present and a quiet retry button.
5. **No scraping.** Use only the documented endpoints.

## Features

### CC-01 Player lookup
Enter a username; show avatar, ratings by time class, record, puzzle rating. Recent lookups are kept locally.

### CC-02 Daily puzzle
Load the FEN, play the solution from the PGN move by move. Wrong move: the piece slides back, one hint available (best piece glow). Streak counter per profile.

### CC-03 Random puzzle
Same player as the daily puzzle. The endpoint returns a new puzzle only every so often; do not request more than once per 20 seconds.

### CC-04 Nemesis bot
"Play like any player."

1. Fetch the archive list, then the most recent months until 200 standard games are collected or 12 months are read.
2. Parse each PGN. For each of the player's games as White and as Black, add the first 12 moves to a tree: position key to move counts.
3. The nemesis bot plays from that tree (weighted by count, minimum 2 occurrences), then switches to the AI.
4. Strength: map the player's rapid rating (or blitz if no rapid) onto the bot strength table, capped at the strongest bot setting. Show "plays the openings of ___, at about ___ strength".
5. Bot card shows the player's three most-played openings as White and as Black (use the ECO or opening name from PGN headers when present).

### CC-05 Blunder replay
1. Take the player's last 20 standard games.
2. In a Web Worker, run the AI on each position after move 8. Flag the player's moves where the evaluation drops by 2 pawns or more and a move existed that kept it level.
3. Each flagged position becomes a puzzle: "you played this. Can you find better?"
4. Update the profile's miss map with the tactic type when a detector identifies it.
Analysis is slow on phones; process in the background, show puzzles as they are found, cap at 10 per session.

### CC-06 Leaderboard peek (optional)
Show the top players in a category; tapping one opens CC-01 and offers CC-04.

## Privacy and terms

- Only public data is read. Nothing is sent to Chess.com except the lookup itself.
- A Chess.com account is never required. Children should not be asked for their own usernames; lookups are an optional feature a parent or teacher can disable in settings.
- Usernames and fetched data are stored only on the device.
- Before any paid release, the owner must review Chess.com's current API terms for commercial use and attribution requirements, and add any required attribution to the Chess.com screen. Do not use Chess.com logos or branding in the app without permission.
