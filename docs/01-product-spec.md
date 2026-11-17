# 01. Product spec

## Users

| User | Needs |
|---|---|
| Child beginner (roughly ages 6 to 12, rating under 800) | See threats before moving. Win small things often. Never feel stupid. |
| Improving player (800 to 1400) | Variety, opening practice, fewer hints over time. |
| Parent or teacher | Know what the child keeps missing. Set up a game in seconds. |

## Design principles

1. **Incremental wins.** A game contains many small successes (found the best piece, kept
   everything defended, completed a goal) independent of the result.
2. **One thing at a time.** One alert per game. One mistake reviewed per game. One mode per match.
3. **Help that fades.** Hints get smaller as the player's rating rises.
4. **Fun rewards skill.** Cards are earned by good chess, not bought or randomly dropped.
5. **Every match is different.** Mode, modifiers, missions and cards change each time.

## Ways to play

| Entry | What happens |
|---|---|
| **Training game** | Standard chess against a bot. One alert active all game. Easy missions shown as open goals. Buffs for the underdog only, no cards. |
| **Party match** | Full pipeline: rotating mode, rating modifiers, secret missions, cards. Against a bot or pass-and-play. |
| **Play the bots** | Pick a bot from the roster. Standard chess. Optional alert. |
| **Puzzles** | Chess.com daily puzzle, random puzzle, blunder replay puzzles. |
| **Play with friends** | Pass-and-play for 2 to 4 on one device, or an online room by code. 3 and 4 player chess, territory modes, hidden roles. See doc 09. |
| **Mini-games** (phase 8) | Single-skill drills. |
| **Arcade** (phase 9) | Captures resolved by a duel. |

## Screens

1. **Home.** Profile chip (nickname, rating, card count), five large buttons: Train, Party match, Play with friends, Bots, Puzzles.
2. **Profile picker.** Several local profiles per device. Nickname and avatar colour only.
3. **Match setup.** Animated reveal in order: mode, modifiers, alert (training only), mission (private), card hand selection.
4. **Board.** Board, captured pieces, clock (optional), card tray, mission peek button (hold to view), alert indicator, hint button where the alert uses one.
5. **Post-game.** Result and reason, "win of the game" replay, "one fix", mission reveal for both sides, rewards (rating change, cards earned, badges).
6. **Bot roster.** Bot cards with name, rating, opening, record against the player.
7. **Collection.** Cards owned, with earn conditions for cards not yet owned.
8. **Chess.com.** Username lookup, profile and stats, puzzles, nemesis bot, blunder replay.
9. **Progress.** Miss map (which tactics are overlooked most), badges, rating history. A "share progress" button produces a printable one-page report for a parent or teacher; no server involved.
10. **Settings.** Sound, clock, board theme, content toggles (a parent can disable modes, modifiers, missions or cards).

## The party match loop

```
choose opponent
  -> draw mode from the mode deck
  -> compute rating gap, assign buffs and handicaps
  -> deal one secret mission to each player
  -> deal one hidden role to each player (online and bot games, once unlocked)
  -> each player chooses up to 3 cards for their hand
  -> play
  -> game ends by: mode win condition, checkmate, mission completed, resignation, draw, time
  -> post-game: win of the game, one fix, rewards, rating update
```

Details of each step are in `02-game-systems.md`.

## Feedback features

| ID | Feature | Rule |
|---|---|---|
| FB-01 | Win of the game | After every game, replay the player's best move (largest evaluation gain, or a completed tactic). Shown even after a loss. |
| FB-02 | One fix | Exactly one mistake is reviewed: the largest evaluation drop. The player retries from that position. |
| FB-03 | Three-move goals | In training, short goals such as "castle in the next three moves" appear one at a time. |
| FB-04 | Skill badges | Fork finder, pin master, no-hang streak, and one badge per tactic detector. |
| FB-05 | Fading hints | Alert strength follows rating bands (see `02-game-systems.md`, section 2). |
| FB-06 | Ghost replay | After a loss, replay from the turning point against the same bot. |
| FB-07 | Miss map | Per-profile tally of tactics available but not played, and threats not answered. |

## Tone

The app never says "blunder" or "mistake" to a child. It says "that piece is in danger, can
you see why?" Losses end on the win of the game.
