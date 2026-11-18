# 08. Decisions and open questions

## Decisions already made in these docs

The owner asked for these behaviours; the details were filled in so the build is unambiguous.
Change any of them here and in the referenced doc.

| # | Decision | Why | Where |
|---|---|---|---|
| D1 | One alert per game, always on, chosen by rating band and miss map | Owner: "trigger one of these a game" | 02 s2 |
| D2 | A different mode every match via a shuffled deck with no repeats | Owner: "different game type each time" | 02 s3 |
| D3 | Modifiers are assigned from the rating gap: buffs to the underdog, handicaps to the favourite | Owner: "modifiers trigger based on ratings" | 02 s4 |
| D4 | Completing a secret mission wins the game at once | Owner: "a secret mission that will end the game" | 02 s5 |
| D5 | Missions go live after each player's move 10 | Without a gate, a mission could end the game in four moves | 02 s5 |
| D6 | Only Medium and Hard missions end the game. Easy ones become open training goals; four that only make sense at game end became bonus objectives | "Castle before move 8" or "win without losing your queen" cannot sensibly end a game | 03 |
| D7 | The favourite gets a Hard mission when the gap is 200 or more | Ties missions to ratings like the modifiers | 02 s5 |
| D8 | Cards are single use and permanently removed when played; earned through chess achievements | Owner: "played one time, then burned" | 02 s6 |
| D9 | Hand of up to 3 cards; one card per turn; upgrade and summon cards use the move | Keeps games recognisably chess | 02 s6 |
| D10 | Bots get missions and modifiers; bots rated 1000 or more carry one signature card | Stronger bots feel like characters | 05 |
| D11 | Hidden-information items are used against bots and online, never in pass-and-play | Two people share one screen | 02 s7, 09 |
| D12 | Custom rules engine and AI; no Stockfish | Variants and modifiers need a custom engine anyway, and Stockfish's GPL licence would bind an app that is sold | 04, CLAUDE.md |
| D13 | No backend in phases 0 to 5. Phase 6 adds a room server for online play. No accounts or personal data in any designed phase | Owner: "definitely multiplayer"; child users | CLAUDE.md, 09 |
| D14 | 18 bots built from opening books plus the shared AI, not trained models | Same result for the player at a fraction of the work | 05 |
| D15 | Several rules from the brainstorm were tightened to be implementable (Safe king, Long jump, Boss battle, Capture the flag, Lava squares, Bodyguard, Twin and others) | The originals were one-liners | 03 |

| D16 | Online play uses room codes, an authoritative server and preset emotes only | Hidden missions and roles must not reach other clients; no chat for children | 09 s2 |
| D17 | Three-player chess uses the four-player cross board with one side empty | One board and one rule set instead of a separate three-sided geometry | 09 s4 |
| D18 | With 3 or 4 players, kings are captured rather than checkmated | Checkmate is not well defined when two other players move before you | 09 s4 |
| D19 | "Territory king of the hill" became two modes: Hill wars (score for holding the centre) and Paint the board (most squares coloured) | Two readings of the idea, both cheap to build | 09 s5 |
| D20 | Assassins, saboteurs and the last pawn became a hidden-roles layer of 8 roles, plus the Contract mode | Owner's idea was one line; this is a first design | 09 s6 |

## Resolved questions

The owner asked for these to be decided on one principle: **favour fun and learning how to play.**

| # | Question | Decision | Where |
|---|---|---|---|
| 1 | Does a mission win count fully for rating? | Half the normal rating change. Checkmate stays the most rewarded skill | 02 s1 |
| 2 | Mission gate | Move 10; move 8 when either player is under 800 | 02 s5 |
| 3 | Card burn | Permanent, as the owner specified. Earn conditions repeat, and players under 800 get a free Common card every third game so they are never empty-handed | 02 s6, s8 |
| 4 | Bots with cards | Yes: bots rated 1000 or more carry one signature card | 05 |
| 5 | Modifiers in training | Yes, buffs for the underdog only. No handicaps in training | 02 s4 |
| 6 | Standard chess in the mode deck | Three copies, so real chess comes up about one match in four | 02 s3 |
| 7 | Arcade duel style | Dice plus a timing tap. No real-time combat | 07 phase 9 |
| 8 | Name | "Chess Tutor" stays as the working title. Not blocking; a name search is needed before public release | README |
| 9 | Selling | Build it free to play first. No payment code in any designed phase. Decide the model after a classroom pilot | CLAUDE.md |
| 10 | Chess.com terms | Cannot be decided here. The Chess.com screen sits behind a settings toggle so it can be removed, and the terms check remains a required step before any paid release | 06 |
| 11 | Teacher dashboard | Not needed for a pilot. The per-device progress screen gets a printable "share progress" report | 01 |
| 12 | Art and sound | The implementing agent makes simple original SVG art and synthesised sounds, behind a theme module for later replacement | CLAUDE.md |
| 13 | Roles | Approved as designed. Unlock after 5 party matches; dealt in about half of matches so they stay a surprise | 09 s6 |
| 14 | Contract mode | Approved: capture your secret target's king to win | 09 s5 |
| 15 | Online ratings | Stay on the device. No public matchmaking | 09 s2 |
| 16 | Server cost | Choose a host with a free tier and stay inside it until the app earns money. If no free tier fits, stop and ask the owner | 09 s2 |
| 17 | Build order | Unchanged. Training comes first because learning is the point; multiplayer depends on the modes being finished, and the Chess.com phase is small | 07 |

## Still needs the owner (not blocking the build)

- Final name, before public release.
- Chess.com API terms review, before any paid release.
- Approval of any hosting cost beyond a free tier.

## Log

Implementing agent: add dated entries below when you resolve an ambiguity or record a spike result.

### 2026-11-17: Phases 0 and 1 built

- **Engine.** `src/core` supports 2 to 4 seats, any board size and blocked squares from the start. Perft matches the reference counts for five positions (start position to depth 4). Castling is a king move with a `castle` flag rather than a separate action type, so tapping the king and its destination works naturally.
- **Fifty-move rule** is applied automatically at 100 half-moves (no claim needed), which is simpler for children.
- **AI.** Alpha-beta with iterative deepening, quiescence, a transposition table and killer moves. Scores are from the root player's view with all other seats as opponents, so it already works for 3 and 4 players. Legality is checked lazily during search; depth 4 takes about 0.5 s in a middlegame. Positional terms are computed from board geometry instead of fixed tables so they work on any board.
- **Bots.** All 18 bots have opening books; a test checks every line is legal. Strength values are the starting table from doc 05 and have not been calibrated by self-play yet (still to do for phase 1 sign-off).
- **Zustand dropped.** State is React state plus a tiny `useSyncExternalStore` wrapper around storage. Add Zustand later only if it is needed.
- **Pass-and-play does not change ratings yet.** Only one profile is active per device session; rating both players needs a second-profile picker (phase 3).
- **Build environment.** This session had no package registry access. The engine and AI were type-checked with `tsc` and tested with a Vitest-compatible runner; the UI was bundled and tested in Chromium with a different bundler. `npm run build` with Vite has not been run yet. The first `npm install && npm run build` (or the CI workflow) is the check. `build` does not run the type check so a type-only error cannot block a deploy; CI runs `typecheck` separately.
- **Worker.** The AI runs in a Web Worker and falls back to the main thread if the worker cannot start.

### 2026-11-17: Owner changes after the first build

- **No pass-and-play.** The owner wants each player on their own device. "Play a friend" is now **Play online** (room code). Online two-player play was pulled forward from phase 6 and is built: `src/net/room.ts` (authoritative, runs the shared engine, tested), a Bun dev server and a Cloudflare Durable Object adapter (`server/`, `wrangler.toml`). Seat held 60 s on disconnect, then a bot takes over until the player returns. Rematch swaps colours. Emotes only, rate-limited; nicknames filtered. The Cloudflare adapter has not been deployed from this session; deploy steps are in the README.
- Pass-and-play remains possible in the engine; 3 and 4 player games (doc 09) should also go online-first. MODE-10 Tag team needs rethinking as an online team mode.
- **No AI in the game.** The owner wants little to no AI. The bots already use a classic hand-written search, not machine learning, and nothing calls an AI service. The parked "plain-language AI coach" idea is **removed**. Any future explanation text (one fix, name the idea) must come from the scripted tactic detectors.
- **Cosmetics.** Piece skins per army with per-piece overrides, and seven board landscapes, chosen in the Wardrobe. All art is drawn in code. Characters wear the hat of their piece type and can show a small classic badge, so the board stays readable for learners. Skins and landscapes are good candidates for unlockable rewards later (badges, missions), in place of or alongside power cards.
- **Look.** Deliberately scrappy: wonky borders, tape, tilted cards, a wobble filter on the board. Fonts come from Bunny Fonts (no visitor logging); self-host them before a paid release.

### 2026-11-17: Party match

- **Built:** mode deck (Classic ×3, King of the hill, Three-check, Capture race, Dice chess, Truce, Capture the flag, Shuffle start, Hill wars), rating-gap modifiers (36 of 48 buffs/handicaps), 15 game-ending secret missions with the move-10 gate (8 under 800), half rating for mission wins, mission reveal at the end. Works against bots and online (room game "Party match"; the server deals and referees, each player only receives their own mission).
- **Simplified missions:** Fork, Pin, Skewer and Sneak attack complete when the tactic is played; "wins material within 2 moves" is not checked. Double their pawns counts any new enemy doubled pawns, not only ones forced by a capture.
- **Missions are refereed outside the core:** a completed mission is recorded as a `mission` action, so replays stay exact and the core never needs to see hidden missions.
- **Bots** get only always-on modifiers and do not chase their mission yet (they still win by checkmate or the mode). Online, the mode is drawn at random by the server rather than from a player's own deck.
- **Not yet playable:** BUFF-04 Scout, 09 Safe king, 13 Rally, 22 Time bank, 23 Peek; HCAP-01 Fog, 08 Blind spot, 10 Tax, 15 Sleepy start, 21 Costume party, 23 Toll road, 24 No take-backs. Bonus missions (03, 09, 20, 24).


### 2026-11-17: Puzzles

- **Built:** Puzzles screen with Chess.com's daily puzzle (CC-02), random puzzle (CC-03) and 8 built-in warm-ups that work offline or when the parent switch hides Chess.com. Wrong moves slide back; one hint per puzzle (the right piece glows); after 3 misses a "Show me" button plays the answer.
- **Any checkmate counts**, even if it is not the move in Chess.com's line.
- **Streak:** solving the daily puzzle on consecutive days. Missing a day resets it. Random and warm-up puzzles do not touch the streak.
- **Coins:** 8 for the daily, 3 for others, halved with a hint, plus a streak bonus up to 7. Each puzzle pays once. Puzzles never change the rating (doc 02).
- **Random puzzle rate limit:** the client caches `/puzzle/random` for 20 seconds, so it never asks more often.
- **No external link** to the puzzle on Chess.com, because the screen is kid-facing; it says "Puzzle from Chess.com" instead.

### 2026-11-17: Training wheels online, every mode online

- **All 2-player modes are room games:** Three-check, Capture race, Dice chess, Truce, Capture the flag and Shuffle start join Classic, King of the hill and Hill wars. The game screen shows a live box for each (checks given, capture points, the dice roll, truce moves left, both flags tinted on the board).
- **Training wheels (owner decision):** in 1 vs 1 online games each player can switch on their own danger alert, hints and goals, as in Train. Only that player sees them. It is set in the lobby or in the game before the first move; the server refuses changes after that, so the other player always knows before they start.
- **Rating stays full** for the player using training wheels (owner: it is usually a lower-rated player against a higher one).
- **The opponent is told** ("Ava has training wheels on") and may untick "Count this game for my rating" before their own first move. Then their rating does not change; coins and the leaderboard record still count. The choice is per game and lives on that player's device.
- Not in 3 and 4 player games (the alerts assume one opponent).

### 2026-11-17: Nemesis bot (CC-04)

- **Built:** Chess.com corner → "Make a nemesis bot". Reads up to 200 standard games from the last 12 months. The player's first 12 moves in each game go into an opening book; a move needs at least 2 games behind it. After the book, the bot uses our own engine at the player's rapid rating (or blitz, bullet, daily), held between 400 and 1400 (the strongest setting). The card shows their top openings from the PGN ECOUrl headers and their usual first move.
- Saved on the profile (up to 6) and listed on the Bot path under "Your nemeses", so it plays offline afterwards. Wins and losses count like any bot game; the first win pays the new-bot bonus.
- **No style copying beyond openings.** The middle game is our engine, not an imitation of the person. Copying style (trades, attack) from game statistics is a possible later step.
- The opening book travels with each AI request (the worker has no access to the save) and is cached in the worker by bot id.

### 2026-11-17: Power cards

- **Built:** 23 of 24 cards play (all but CARD-23 Decoy king, which needs hidden information). Collection on the profile, a hand of up to 3 picked on the Power cards screen (also in Party setup and the online lobby), played from the Party match panel, burned after the game. Earning runs after every finished 1 vs 1 game; players under 800 get a random Common every third game.
- **Engine:** cards are rule modules attached as `CARD-xx@player` and played with the existing `buff` action, so every game still replays from its record. New move patterns: rides that pass own pieces (Ghost bishop) or one piece (Jumper rook), seat-relative rides (Lance), the grasshopper hop and the cannon. One card per turn. Card pieces wear their base piece's art with a badge; Phoenix, Bomb and Bodyguard marks are shown to both players.
- **Hands are public** once the game starts: both players see what the other brought and what has been used.
- **Earn conditions simplified:** "win material with a fork / discovered attack" counts when the tactic is played. Twin (Draft), Grasshopper (Mini board) and Bomb pawn (Atomic) need modes that are not built yet; until then they come only from the beginner gift. Decoy king cannot be earned yet.
- **Bots** do not carry or play cards yet (docs/05 signature cards are later). Cards are only used in Party matches; the card play is not shown in the move list.
- **Wall** stops riders, but leapers (knights) can still jump it; Jumper rook and Grasshopper may pass it. Bomb pawn does not explode on an en passant capture.

### 2026-11-17: Full game analysis

- **Built:** "🔍 Full analysis" on any finished 1 vs 1 game (after the game, and when replaying My games, including Chess.com imports). Every move is graded (Great move, Good, Hmm, Oops, Big oops) against our own engine at depth 2 with quiescence, with a plain-words reason from the tactic detectors (piece left hanging, missed fork, allowed checkmate) and arrows for the move played and the better one. A who-was-winning graph and a simple 0 to 100 game score per player.
- **No AI service.** It is the same search the bots use, so it sees about as far as a 1400 player.
- Fixed while building it: the search scores a position with only one legal move as 0, which hid blunders such as a queen sacrifice the king must take. Analysis and the post-game review now look one move further in that case.

### 2026-11-17: Training wheels by request (owner change)

- Training wheels are no longer switched on in the lobby. Once both players are in the room and before the first move, a player taps "Ask for training wheels". The other player answers: **Yes, just for fun** (their own rating does not change), **Yes, and it counts** (both ratings count), or **No thanks**. After a no, the asker chooses to play without them or leave. Moves wait while a question is open. Against a bot that took over a seat, the request is accepted at once.
- The asker's rating always counts (earlier owner decision). The answer stays with the players across rematches in the same room.

### 2026-11-17: Seventeen more modes

- **Built:** Atomic, Giveaway, Racing kings, Wrap-around, Lava squares, Mini board, Horde, Monster, Shrinking board, Progressive, Drop-in, Boss battle, Mystery army, Hidden queen and Draft (all in the new Game modes screen against a bot and in Play online under "More modes"; all but Draft are in the Party match deck), plus Puzzle gauntlet and Endgame survival in Puzzles. Rules in `src/core/modes2.ts`, one test each in `tests/modes2.test.ts`.
- **Atomic:** played without check rules (like the battles): you win by blowing up or capturing the king; you may not blow up your own king.
- **Giveaway:** kings become ordinary pieces ("commoner"). Bare kings are not a draw in Atomic, Giveaway, Horde, Monster and Racing kings.
- **Lava:** lava blocks moving onto and sliding through it; it does not block attacks or checks.
- **Monster:** White's king must be safe after each of its two moves (the catalog only requires it at the end of the turn), and White may never take the king between its two moves.
- **Hidden queen:** the secret pawn attacks only as a pawn until it moves as a queen; then it becomes a real queen. Online, the other player is told only that a pawn was marked. Bots mark a pawn too, and in bot games the bot knows your mark.
- **Draft:** each player buys an army privately (30 points, king free, up to 15 pieces) and the game places it: pieces on the back row centre-out, pawns on the second row. The catalog's alternate picking and hand placement are not built.
- **Boss battle:** the higher-rated player is the Boss (in Party matches, Black is). The Boss gets the queen's square.
- **Mini board:** Gardner layout (R N B Q K on the first row).
- **Endgame survival:** 5 positions against the strongest bot, unrated; a draw counts as holding out. **Puzzle gauntlet:** 3 lives through the warm-ups, then today's and random Chess.com puzzles; best score saved.
- **Invites** now name the mode, say what it is, and give the clock.
- The AI does not plan for Monster's and Progressive's extra moves or for drops; it still plays legal moves.
