# Scheduled agent runs

The scheduled agent runs that work on Chess Chaos, copied word for word from where they run today (Claude's scheduled
tasks, on the owner's claude.ai account) on 2026-11-20 (owner: "individuals and businesses should truly own the
harnesses and data that agents rely on"). This is the owner's copy, so any agent tool or a scheduled GitHub Action can
run the same job. **Keep it true:** when the scheduled task changes, change it here too.

**To run it somewhere else:** give the prompt below to any coding agent that can clone the repo, run `npm`, run
Playwright's Chromium and open a GitHub pull request, on the schedule shown. Where it says "the session cost counter",
"get_session" or "Reply here", use the new tool's cost report, its model name and its summary output instead.

## Weekly Chess Chaos check

- **Schedule:** `CRON_TZ=America/New_York 35 20 * * 4` (every Thursday at 8:35 pm, New York time); on
- **Runs as:** a fresh session each time
- **claude.ai id:** `trig_01PuirkC6ukmiAjs4fcghgqf`

```text
Weekly Chess Chaos check (owner asked for this on Nov 18, 2026: "a weekly check of this app, focus on changes in bots over time and general fairness of games, and a first time visitor").

Repo: andyMattick/Chess_Chaos (a kids' chess tutor and party game; live at chess-chaos-seven.vercel.app). If the repo is not in this session, attach it with push access and clone it; always work from a fresh clone or a fresh branch off the latest main. Read CLAUDE.md, then follow docs/WEEKLY-CHECK.md exactly (steps 0 to 7). Note the session cost counter at the start.

In short: run the tests; the bot ladder (scripts/bot-ladder.ts) compared with last week in docs/weekly/history.json; the mode fairness sim (scripts/simulate-modes.ts, 12 games per mode, one process per mode in parallel); the Party match sim with buffs, handicaps and secret missions (scripts/simulate-party.ts, 8 games per mode, ★800 vs ★1200); and the first-time visitor walkthrough (build, serve locally, node scripts/first-visit.mjs), then look at every screenshot yourself as a 9-year-old who has never seen the app. If Playwright or a browser is not available, say so; do not guess the result.

Rules:
- Fix only crashes, stalls and first-visit breakages (blank screen, untappable button, sideways scroll), each with a test or check. Game balance, rules, missions and bot strengths are the owner's call: list them as suggestions, do not change them.
- Never weaken or skip a test. Never call an AI service from the app. Never touch the live room server (no wrangler deploy) or any player data.
- Docs (docs/weekly/<date>.md, docs/weekly/history.json, a row in docs/weekly/EFFICIENCY.md) go in one docs-only pull request; fixes in a second pull request. Merge each when CI is green; if CI is red for an unrelated reason, leave it open and say so.
- Budget about $4 for the whole run. If time or money runs short, finish the ladder and the party sim first and say what was skipped.
- Commit messages end with the session's Co-Authored-By and Claude-Session lines.

Reply here in plain words, under 15 lines: tests; ladder (any pair where the stronger bot no longer clearly wins, and what moved since last week); modes and party fairness (flags only); secret missions (any that are never undone or always undone); first visitor (what broke, top 3 suggestions); what was fixed and the pull request links; what waits for the owner; the efficiency row with one sentence on whether this week was better or worse than last.
```
