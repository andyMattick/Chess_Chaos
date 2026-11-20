# Instructions for the implementing agent

> **One rulebook for every agent tool** (owner, 2026-11-20: "individuals and businesses should truly own the harnesses and data
> that agents rely on"). This file, `AGENTS.md`, is the only copy of the rules; `CLAUDE.md` just points here. Change the rules
> here, never in `CLAUDE.md` (`tests/portable.test.ts`). The scheduled agent runs are in `docs/automation/SCHEDULED-TASKS.md`.

You are building Chess Tutor from the docs in `docs/`. Read all of them before writing code.
`docs/07-roadmap.md` is the build order. Do one phase at a time and stop at each phase's
acceptance criteria.

## Target

- Standalone web app, hosted as static files (Vercel or GitHub Pages). No backend in phases 0 to 5.
- A small room server handles online play (doc 09): `npm run server` locally, Cloudflare in production. `core/`, `tactics/`,
  `content/` and `systems/` are shared by client and server, so keep them free of browser
  and Node specifics.
- The engine supports 2 to 4 seats and non-rectangular boards from phase 0.
- Must not depend on any claude.ai sandbox API (`window.storage`, `window.claude.complete`).
- Primary device: tablet and phone in landscape or portrait. Touch first, mouse second.
- Audience includes children. No accounts, no personal data, no ads, no chat, no external
  links from kid-facing screens.

## Stack

- TypeScript (strict), React, Vite.
- State: Zustand. Persistence: localStorage behind a single `storage` module with versioned schema.
- Tests: Vitest for the engine. Playwright smoke test for the main flows.
- Board: custom SVG renderer. Do not use a third-party board component; the app needs
  variable board sizes, blocked squares, fairy pieces and per-square overlays.
- Engine and AI: written in this repo (see `docs/04-engine-architecture.md`). Do not add
  Stockfish or any GPL-licensed code; the owner intends to sell this app. Check the licence
  of every dependency before adding it and prefer MIT, BSD or Apache.

## Layout

```
src/
  core/        pure TypeScript, no DOM, no React. Rules engine, pieces, modes, modifiers.
  ai/          search and evaluation, runs in a Web Worker.
  tactics/     attack maps, exchange evaluation, tactic detectors.
  content/     data files: modes, buffs, handicaps, missions, cards, alerts, bots, books.
  systems/     match setup pipeline, rating, rewards, mode deck, miss map.
  chesscom/    API client, cache, PGN import.
  ui/          React components and screens.
  storage/     persistence.
  net/         online room protocol, authoritative room server, browser client.
server/        online room server (phase 6); imports core, tactics, content, systems.
```

`core/`, `ai/` and `tactics/` must not import from `ui/`.

## Rules for the work

1. Content is data. Every mode, modifier, mission, card and alert is an entry in `content/`
   with the ID from `docs/03-content-catalog.md`. Do not hard-code content behaviour in UI code.
2. Everything in `core/` is deterministic. Randomness comes from a seeded generator stored in
   game state, so any game can be replayed from its seed and action list.
3. Every content item ships with at least one test. Mission and tactic detectors are tested
   from FEN fixtures. Standard chess is validated with perft counts.
4. Compatibility is enforced by tags, not by special cases (see `docs/02-game-systems.md`, section 7).
5. Where a rule in the catalog is ambiguous, follow the written definition, add a note to
   `docs/08-decisions-and-open-questions.md`, and keep going. Do not invent new content.
6. Kid-facing text: short sentences, no chess jargon without a one-line explanation,
   never negative about the player.
7. Ship each phase playable. A phase is not done until its acceptance criteria pass and
   `npm test` is green.

## Art and sound

Make simple original SVG piece glyphs and bot avatars in code, and synthesise sound effects
with the Web Audio API. Keep all art behind a theme module so an artist's set can replace it later.

## Out of scope until the owner says otherwise

Accounts, public matchmaking, teacher dashboard, payments, native app wrappers.
Never: calls to AI services or generated content at runtime (owner decision, doc 08 log).
Online two-player play by room code is built (src/net, server/). No pass-and-play UI.
