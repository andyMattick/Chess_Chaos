# Weekly check (owner request, 2026-11-18)

Once a week a scheduled Claude run checks Chess Chaos with the game's own engine and a scripted browser. No AI service is added to the app and nothing touches the live room server. Focus: **how the bots change over time** and **whether the games are fair**, plus **a first-time visitor's walk through the app**.

Every number comes from a script with fixed seeds, so a change week to week means the code changed, not luck in the seed. (Small samples still swing; a finding needs two weeks in a row, or a big jump, before it counts.)

## Steps

0. Fresh clone of `andyMattick/Chess_Chaos` (main). Note the session cost at the start.
1. **Tests:** `bun test` (or `npm ci && npm test`). Report pass/fail. CI on GitHub runs the typecheck.
2. **Bot ladder (bots over time):** `bun scripts/bot-ladder.ts 6 > ladder.json`. Each bot on the Bot Path plays the next one up 6 times. Flag a pair when the stronger bot scores under 3.5 of 6 (the path stops getting harder there), or when its score moved by 2 or more since the last week in `docs/weekly/history.json`.
3. **Mode fairness:** `bun scripts/simulate-modes.ts 12 800 <mode>` for every mode, one process per mode, as many at once as there are CPUs. Flag: any crash or stall; a mode where one side wins 10 or more of 12; draws in more than 4 of 12; average length under 8 or over 80 moves.
4. **Party fairness and secret missions:** `bun scripts/simulate-party.ts 8 800 1200 <mode>` for every mode in the Party deck (a ★800 bot with buffs against a ★1200 bot with handicaps). Flag: underdog wins under 35% or over 65% overall; a mode where the favourite wins 8 of 8; for secret missions (the `byId` lines): a mission shown 3+ times and never undone (too hard to stop in the defence turns), or shown 3+ times and always undone (never worth doing).
5. **First-time visitor:** build (`npm run build`), serve `dist/` on a local port, run `node scripts/first-visit.mjs http://localhost:<port> <scratch>/first-visit` (set `PLAYWRIGHT=` to the Playwright module path if it is not in node_modules). Then look at every screenshot yourself as a 9-year-old who has never seen the app: blank screens, things cut off, sideways scroll, buttons that are hard to find, too much text, words a child would not know. At most 3 suggestions, most important first.
6. **Fixes:** only crashes, stalls, and first-visit breakages (blank screen, a button that cannot be tapped, sideways scroll), each with a test or a check that would have caught it. **Game balance and rules are the owner's call:** list balance findings as suggestions; do not change rules, missions or bot strengths in this run.
7. **Report:** write `docs/weekly/<date>.md` (short: the tables below, findings, suggestions), add this week's numbers to `docs/weekly/history.json` (numbers only), and one row to `docs/weekly/EFFICIENCY.md`: date | cost in dollars ("not measured" if unknown) | tests | ladder flags | mode flags | party flags | first-visit result | fixed | left for the owner | repeats (flags already in last week's report). Docs go in one docs-only pull request; fixes in a second pull request. Merge each when CI is green.

## What cannot be checked here

The Mirror bot and the learning nemeses live on each player's phone; cloud saves are locked with keys only players have. The weekly check sees only the built-in bots and the engine, never player data.

## Report tables

- Ladder: lower bot | higher bot | higher bot's score of 6 | last week | change
- Modes: mode | White | Black | draws | avg moves | flag
- Party: mode | underdog | favourite | draws | missions shown / undone / won | flag
- Missions: mission | shown | undone | won
- First visit: step | ok | ms | note
