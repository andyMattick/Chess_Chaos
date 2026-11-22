# World of C.H.A.O.S.

A standalone web app that teaches kids chess through small, visible wins, wrapped in a
party-game layer (rotating game modes, rating-based modifiers, secret missions, power-piece
cards), with opening bots and Chess.com public data on top.

Built so far: the rules engine, the board, the AI and 18 opening bots, local profiles and
ratings, saved-game replay, online play by room code, piece skins and board landscapes. An implementing agent should read
`CLAUDE.md` first, then the docs in order, then the log at the end of
`docs/08-decisions-and-open-questions.md`.

## Run it

```
npm install
npm run dev        # the game, on http://localhost:5173
npm run server     # the online room server, on ws://localhost:8787 (needs Bun)
npm test           # engine, AI, bot-book and room-server tests (Vitest)
npm run typecheck
npm run build      # static site in dist/
```

## Put it online (free)

**The game (static site).** Import the repo on Vercel and accept the detected Vite settings.

**The room server (online play).** It runs on Cloudflare's free tier:

1. Make a free Cloudflare account.
2. In this folder: `npx wrangler login`, then `npx wrangler deploy`.
3. Wrangler prints a URL like `https://chess-chaos-rooms.<you>.workers.dev`.
4. On Vercel, add an environment variable `VITE_ROOM_SERVER` = `wss://chess-chaos-rooms.<you>.workers.dev/ws` and redeploy.

Without step 4 the game still works (bots, wardrobe, replays); the Play online screen just says it isn't switched on.

## No AI at runtime

Nothing in the game calls an AI service. The bots use a classic hand-written chess search
(alpha-beta), opening books written by hand, and fixed rules for how often they slip up.
All art is drawn in code (SVG), so it can be edited directly.

## What the app is

0. **Looks.** Piece skins (gremlins, robots, ghosts, critters, angry veg, classic) per army or per piece, and seven board landscapes.
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
| `docs/11-feature-status.md` | What is built, partly built and planned, item by item |

## Status

Built: phases 0 and 1. Designed: phases 2 to 7. Outlined: phases 8 to 10.
Items the owner still needs to confirm are in `docs/08-decisions-and-open-questions.md`.
