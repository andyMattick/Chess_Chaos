# Chess Chaos

A standalone web app that teaches kids chess through small, visible wins, wrapped in a
party-game layer (rotating game modes, rating-based modifiers, secret missions, power-piece
cards), with opening bots and Chess.com public data on top.

This repo starts as a design handoff. No code exists yet. An implementing agent should read
`CLAUDE.md` first, then the docs in order.

## What the app is

1. **Training mode.** One teaching alert is switched on for a whole game (for example,
   "danger squares always shown"). Post-game review celebrates one good move and fixes one mistake.
2. **Party match.** Every match draws a different game mode, applies buffs or handicaps
   based on the rating gap, deals each player a secret mission that can end the game, and
   lets each player bring single-use power-piece cards.
3. **Play the bots.** 16 bots, each with a signature opening and a personality.
4. **Chess.com layer.** Daily and random puzzles, player profiles and stats, a "nemesis bot"
   built from any public player's games, and blunder replay puzzles.
5. **Multiplayer.** Pass-and-play and online rooms for 2 to 4 players, 3 and 4 player chess,
   territory modes, and hidden roles (assassin, saboteur, last pawn).
6. **Later:** tutor mini-games, arcade duel mode, teacher dashboard, AI coach.

## Docs

| File | Contents |
|---|---|
| `CLAUDE.md` | Instructions for the implementing agent: stack, conventions, build order |
| `docs/01-product-spec.md` | Users, principles, screens, the match loop |
| `docs/02-game-systems.md` | Rules for alerts, mode rotation, modifiers, missions, cards, ratings |
| `docs/03-content-catalog.md` | Every alert, mode, buff, handicap, mission and card, with IDs and tags |
| `docs/04-engine-architecture.md` | Rules engine, AI, tactic detectors, data model, testing |
| `docs/05-bots.md` | Bot roster, opening books, strength control |
| `docs/06-chesscom-integration.md` | Endpoints, features, caching, limits |
| `docs/07-roadmap.md` | Phases with acceptance criteria |
| `docs/08-decisions-and-open-questions.md` | Calls already made, and questions for the owner |
| `docs/09-multiplayer-and-roles.md` | Online rooms, 3 and 4 player chess, territory modes, hidden roles |
| `docs/10-idea-index.md` | Every idea from planning, its status, and where it is specified |

## Status

Design complete for phases 0 to 7. Phases 8 to 10 are outlined only.
Items the owner still needs to confirm are in `docs/08-decisions-and-open-questions.md`.
