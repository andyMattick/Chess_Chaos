# 07. Roadmap

Build in this order. Each phase ends playable and deployed. Do not start a phase until the
previous one meets its acceptance criteria.

## Phase 0. Foundation

Scope: project scaffold, core engine for standard chess, SVG board, pass-and-play.

Acceptance:
- Perft counts match for the starting position to depth 4 and for two further reference positions.
- All standard rules work: castling, en passant, promotion choice, check, checkmate, stalemate, threefold repetition, fifty-move rule, insufficient material.
- Two people can play a full game on one device, touch and mouse.
- Game is stored as `{ setup, seed, actions }` and can be replayed.
- Deployed to a static host. CI runs tests on every push.

## Phase 1. AI and bots

Scope: search and evaluation in a Web Worker, strength settings, opening books, bot roster, profiles and ratings.

Acceptance:
- AI solves the mate-in-2 fixtures and never plays an illegal move.
- All 18 bots are playable; each follows its book for the signature opening (tested).
- Adjacent bots are calibrated by self-play.
- Local profiles with rating updates and bot records.

## Phase 2. Training mode

Scope: tactics module, the 10 alerts, alert selection by rating band, post-game review (win of the game, one fix), three-move goals from Easy missions, miss map, badges.

Acceptance:
- Every tactic detector passes its fixtures.
- Each alert works for a full game and exactly one is active per game.
- Post-game always shows one positive move and at most one fix.
- Miss map updates and influences the next alert choice.

## Phase 3. Party systems

Scope: rule-module architecture, compatibility tags, match setup pipeline and reveal, rating-gap modifiers (24 buffs, 24 handicaps), secret missions with gate and reveal, bonus objectives, cards (24) with collection, earn conditions, hand selection and burn. Runs on MODE-00 only.

Acceptance:
- Every buff, handicap, mission and card has passing tests.
- Modifier assignment follows the gap table exactly (tested at each boundary).
- A mission completed after the gate ends the game with reason `mission`; before the gate it does not.
- A played card is removed from the collection; unplayed cards return.
- The AI plays legally under every modifier and pursues its mission.
- Property test: random games with random modifiers, missions and cards never throw.

## Phase 4. Modes

Scope: mode deck and unlocks, then modes in tier order.
- 4a: tier A (MODE-01, 02, 03, 05, 06, 10, 20, 22).
- 4b: tier B (MODE-04, 07, 08, 09, 13, 14, 15, 16, 17, 21, 23, 24).
- 4c: tier C (MODE-18, 19) and solo challenges (MODE-11, 12).

Acceptance:
- Each mode has rule tests and is playable against the AI.
- The mode deck never repeats a mode until all unlocked modes have been played.
- Compatibility filtering verified for every mode against every item (property test from phase 3 extended to all modes).
- Boss battle and Monster are playtested for balance and their numbers adjusted.

## Phase 5. Chess.com

Scope: API client with queue and cache, cross-origin spike, CC-01 to CC-05.

Acceptance:
- Spike result recorded in `08-decisions-and-open-questions.md`; proxy added only if needed.
- Client never sends parallel requests and handles 404, 410 and 429.
- Daily and random puzzles are playable.
- Nemesis bot builds from a real username and plays that player's most common first moves.
- Blunder replay produces puzzles from real games without freezing the UI.

## Phase 6. Online multiplayer (two players)

Scope: room server running the shared engine, room codes, filtered state per seat, emotes, reconnect and bot takeover, party matches online with hidden-information content enabled. See doc 09, sections 1 and 2.

Acceptance:
- Two devices complete a full party match through a room code.
- A client never receives another seat's mission, hand, role or hidden squares (tested by inspecting messages).
- The server rejects illegal actions and out-of-turn actions.
- Disconnect, bot takeover and rejoin work.
- Hosting choice and running cost recorded in doc 08.

Note: the engine must already support 2 to 4 seats from phase 0 (doc 09, section 3). Phase 6 adds the network, not the seat model.

## Phase 7. Three and four players, territory modes, hidden roles

Scope: cross-shaped board, MODE-25 to MODE-31, multi-seat AI, pass-and-play and online for 3 and 4 seats, roles ROLE-01 to ROLE-08. See doc 09, sections 4 to 6.

Acceptance:
- Three-way, four-way and teams games play to completion against bots, on one device, and online.
- Hill wars and Paint the board work with 2, 3 and 4 seats.
- Every role has passing tests and is revealed post-game.
- Contract mode transfers targets correctly when a king falls.
- Roles and Boss-style balance numbers playtested and adjusted.

## Phase 8. Tutor extras (outline)

Mini-games MINI-01 to MINI-09, opening trainer (bots quiz the player on their line with spaced repetition), ghost replay, handicap ladder. Replace the temporary earn conditions on CARD-11 and CARD-22.

## Phase 9. Arcade duel mode (outline)

When a capture is attempted, a short duel decides it.

Design (confirmed: dice plus timing, no real-time combat):
- Each piece type has health and attack scaled to its value; the attacker strikes first.
- Stronger pieces usually win. Starting odds for the attacker: 65% at equal value, plus 5 points per point of value advantage, minus 5 per point of disadvantage, limited to between 20% and 95%.
- The player influences the roll with a simple timing tap (good timing adds up to 10 points).
- Attacker wins: the capture happens. Defender wins: the attacker returns to its square and the turn ends. No piece is lost on a failed attack.
- Kings always win their duels, so check and checkmate work as in normal chess.
- Original characters and animations only; no likeness to any existing fighting game.
- The AI evaluates captures by expected value.

## Phase 10. Accounts and classroom (not designed)

Accounts, teacher dashboard with class miss maps and assignable drills, class improvement ladder, public matchmaking, plain-language AI coach. Requires a privacy review for child users before any design work.
