# 11. Feature status

Where every planned feature stands. **Built** = in the live game. **Partly** = some of it is built. **Planned** = fully written up in the docs, not built yet.

Rules for each item are in `docs/03-content-catalog.md` (and `docs/09-multiplayer-and-roles.md` for MODE-25 to 31 and roles).


## Training alerts (10)

| ID | Name | Status | Where |
|---|---|---|---|
| ALERT-01 | Danger squares | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-02 | Hanging alarm | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-03 | Best piece glow | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-04 | Best square glow | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-05 | Pick from three | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-06 | Hot and cold | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-07 | Name the idea | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-08 | What does that move want? | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-09 | Second look | Built | Train mode (`src/ui/training.tsx`) |
| ALERT-10 | Count the fight | Built | Train mode (`src/ui/training.tsx`) |

## Game modes (32)

Built so far: Classic, King of the hill, Hill wars (2 and 4 players), 3-way, 4-way and 2 vs 2 teams, against bots and online.

| ID | Name | Status | Where |
|---|---|---|---|
| MODE-00 | Standard | Built | Bots, online, Train |
| MODE-01 | Random piece | Built | Party match |
| MODE-02 | King of the hill | Built | Battle modes (vs bot), Play online |
| MODE-03 | Three-check | Built | Party match |
| MODE-04 | Horde | Built | Game modes, Party match, Play online |
| MODE-05 | Shuffle start | Built | Party match |
| MODE-06 | Capture race | Built | Party match |
| MODE-07 | Draft | Built | Game modes, Play online |
| MODE-08 | Boss battle | Built | Game modes, Party match, Play online |
| MODE-09 | Shrinking board | Built | Game modes, Party match, Play online |
| MODE-10 | Tag team | Planned | Party match (not built yet) |
| MODE-11 | Puzzle gauntlet | Built | Puzzles (Gauntlet) |
| MODE-12 | Endgame survival | Built | Puzzles (Survival) |
| MODE-13 | Atomic | Built | Game modes, Party match, Play online |
| MODE-14 | Drop-in | Built | Game modes, Party match, Play online |
| MODE-15 | Giveaway | Built | Game modes, Party match, Play online |
| MODE-16 | Racing kings | Built | Game modes, Party match, Play online |
| MODE-17 | Progressive | Built | Game modes, Party match, Play online |
| MODE-18 | Wrap-around | Built | Game modes, Party match, Play online |
| MODE-19 | Hidden queen | Built | Game modes, Party match, Play online |
| MODE-20 | Capture the flag | Built | Party match |
| MODE-21 | Lava squares | Built | Game modes, Party match, Play online |
| MODE-22 | Truce | Built | Party match |
| MODE-23 | Mini board | Built | Game modes, Party match, Play online |
| MODE-24 | Monster | Built | Game modes, Party match, Play online |
| MODE-25 | Mystery army | Built | Game modes, Party match, Play online |
| MODE-26 | Three-way | Built | Battle modes, Play online |
| MODE-27 | Four-way | Built | Battle modes, Play online |
| MODE-28 | Four-way teams | Built | Battle modes, Play online |
| MODE-29 | Hill wars | Built | Battle modes (1v1 and 4-way), Play online |
| MODE-30 | Paint the board | Built | Party match |
| MODE-31 | Contract | Planned | Party match (not built yet) |

## Buffs (positive modifiers) (24)

| ID | Name | Status | Where |
|---|---|---|---|
| BUFF-01 | Double step | Built | Party match (vs bot and online) |
| BUFF-02 | Shield | Built | Party match (vs bot and online) |
| BUFF-03 | Take-back | Built | Party match (vs bot and online) |
| BUFF-04 | Scout | Built | Party match |
| BUFF-05 | Pawn sprint | Built | Party match (vs bot and online) |
| BUFF-06 | Second wind | Built | Party match (vs bot and online) |
| BUFF-07 | Long jump | Built | Party match (vs bot and online) |
| BUFF-08 | Early crown | Built | Party match (vs bot and online) |
| BUFF-09 | Safe king | Built | Party match |
| BUFF-10 | Backpedal | Built | Party match (vs bot and online) |
| BUFF-11 | Swap | Built | Party match (vs bot and online) |
| BUFF-12 | Bonus hint | Built | Party match (vs bot and online) |
| BUFF-13 | Rally | Built | Party match |
| BUFF-14 | Reinforcements | Built | Party match (vs bot and online) |
| BUFF-15 | Freeze ray | Built | Party match (vs bot and online) |
| BUFF-16 | Royal dash | Built | Party match (vs bot and online) |
| BUFF-17 | Sidestep | Built | Party match (vs bot and online) |
| BUFF-18 | Knight's blessing | Built | Party match (vs bot and online) |
| BUFF-19 | X-ray | Built | Party match (vs bot and online) |
| BUFF-20 | Recall | Built | Party match (vs bot and online) |
| BUFF-21 | Home guard | Built | Party match (vs bot and online) |
| BUFF-22 | Time bank | Built | Party match |
| BUFF-23 | Peek | Built | Party match |
| BUFF-24 | Safety net | Built | Party match (vs bot and online) |

## Handicaps (negative modifiers) (24)

| ID | Name | Status | Where |
|---|---|---|---|
| HCAP-01 | Fog | Built | Party match |
| HCAP-02 | Frozen piece | Built | Party match (vs bot and online) |
| HCAP-03 | Tired queen | Built | Party match (vs bot and online) |
| HCAP-04 | Butterfingers | Built | Party match (vs bot and online) |
| HCAP-05 | Slow pawns | Built | Party match (vs bot and online) |
| HCAP-06 | No castling | Built | Party match (vs bot and online) |
| HCAP-07 | Short clock | Built | Party match (vs bot and online) |
| HCAP-08 | Blind spot | Built | Party match |
| HCAP-09 | Heavy rooks | Built | Party match (vs bot and online) |
| HCAP-10 | Tax | Built | Party match |
| HCAP-11 | Mirror | Built | Party match (vs bot and online) |
| HCAP-12 | Homesick king | Built | Party match (vs bot and online) |
| HCAP-13 | Forced capture | Built | Party match (vs bot and online) |
| HCAP-14 | Missing pawn | Built | Party match (vs bot and online) |
| HCAP-15 | Sleepy start | Built | Party match |
| HCAP-16 | Silent board | Built | Party match (vs bot and online) |
| HCAP-17 | Rusty crown | Built | Party match (vs bot and online) |
| HCAP-18 | Slippery board | Built | Party match (vs bot and online) |
| HCAP-19 | One-way rooks | Built | Party match (vs bot and online) |
| HCAP-20 | Peaceful bishops | Built | Party match (vs bot and online) |
| HCAP-21 | Costume party | Built | Party match |
| HCAP-22 | Restless king | Built | Party match (vs bot and online) |
| HCAP-23 | Toll road | Built | Party match |
| HCAP-24 | No take-backs | Built | Party match |

## Secret missions (24)

| ID | Name | Status | Where |
|---|---|---|---|
| MISSION-01 | Castle before move 8 | Partly | Built as a Train mode goal; not yet a secret mission |
| MISSION-02 | Capture with a knight | Partly | Built as a Train mode goal; not yet a secret mission |
| MISSION-03 | Win without losing your queen | Built | Party match |
| MISSION-04 | Promote a pawn | Built | Party match secret mission |
| MISSION-05 | Deliver a fork | Built | Party match secret mission |
| MISSION-06 | Pin a piece to the king | Built | Party match secret mission |
| MISSION-07 | Rook on the seventh | Built | Party match secret mission |
| MISSION-08 | Nothing left hanging | Partly | Built as a Train mode goal; not yet a secret mission |
| MISSION-09 | Mate with a minor piece | Built | Party match |
| MISSION-10 | Own the centre | Built | Party match secret mission |
| MISSION-11 | Trade queens while ahead | Built | Party match secret mission |
| MISSION-12 | Check three times | Built | Party match secret mission |
| MISSION-13 | Develop the minors | Partly | Built as a Train mode goal; not yet a secret mission |
| MISSION-14 | Discovered attack | Built | Party match secret mission |
| MISSION-15 | Land a skewer | Built | Party match secret mission |
| MISSION-16 | En passant | Built | Party match secret mission |
| MISSION-17 | Passed pawn | Built | Party match secret mission |
| MISSION-18 | Double their pawns | Built | Party match secret mission |
| MISSION-19 | Keep the bishop pair | Built | Party match secret mission |
| MISSION-20 | Back-rank mate | Built | Party match |
| MISSION-21 | Knight outpost | Built | Party match secret mission |
| MISSION-22 | Connect the rooks | Partly | Built as a Train mode goal; not yet a secret mission |
| MISSION-23 | Stack the rooks | Built | Party match secret mission |
| MISSION-24 | Sacrifice and win | Built | Party match |

## Power-up cards (24)

| ID | Name | Status | Where |
|---|---|---|---|
| CARD-01 | Chancellor | Built | Party match |
| CARD-02 | Archbishop | Built | Party match |
| CARD-03 | Amazon | Built | Party match |
| CARD-04 | Super pawn | Built | Party match |
| CARD-05 | Jumper rook | Built | Party match |
| CARD-06 | Ghost bishop | Built | Party match |
| CARD-07 | Nightrider | Built | Party match |
| CARD-08 | Bodyguard | Built | Party match |
| CARD-09 | Cannon | Built | Party match |
| CARD-10 | Wall | Built | Party match |
| CARD-11 | Teleporter | Built | Party match |
| CARD-12 | Twin | Built | Party match |
| CARD-13 | Camel | Built | Party match |
| CARD-14 | Grasshopper | Built | Party match |
| CARD-15 | Dragon rook | Built | Party match |
| CARD-16 | Dragon bishop | Built | Party match |
| CARD-17 | Lance | Built | Party match |
| CARD-18 | Phoenix | Built | Party match |
| CARD-19 | Bomb pawn | Built | Party match |
| CARD-20 | Magnet | Built | Party match |
| CARD-21 | Battering ram | Built | Party match |
| CARD-22 | Medic | Built | Party match |
| CARD-23 | Decoy king | Planned (needs hidden information) | Party match |
| CARD-24 | Guard | Built | Party match |

## Hidden roles (assassins, saboteurs, last pawn…) (8)

| ID | Name | Status | Where |
|---|---|---|---|
| ROLE-01 | Assassin | Planned | Party match, online |
| ROLE-02 | Last pawn | Planned | Party match, online |
| ROLE-03 | Saboteur | Planned | Party match, online |
| ROLE-04 | Spy | Planned | Party match, online |
| ROLE-05 | Bodyguard | Planned | Party match, online |
| ROLE-06 | Sleeper | Planned | Party match, online |
| ROLE-07 | Turncoat | Planned | Party match, online |
| ROLE-08 | Decoy | Planned | Party match, online |

## Tutor mini-games (9)

| ID | Name | Status | Where |
|---|---|---|---|
| MINI-01 | Pawn wars | Built | 2026-11-18, Mini-games screen |
| MINI-02 | Piece mazes | Built | 2026-11-18, Mini-games screen |
| MINI-03 | Capture the candy | Built | 2026-11-18, Mini-games screen |
| MINI-04 | Checkmate ladder | Built | 2026-11-18, Mini-games screen |
| MINI-05 | Mate in one sprint | Built | 2026-11-18, Mini-games screen |
| MINI-06 | Guard duty | Built | 2026-11-18, Mini-games screen |
| MINI-07 | Trade or no trade | Built | 2026-11-18, Mini-games screen |
| MINI-08 | Spotlight | Built | 2026-11-18, Mini-games screen |
| MINI-09 | Handicap ladder | Built | 2026-11-18, Mini-games screen |

## Everything else

| Feature | Status | Where |
|---|---|---|
| Rules engine (2 to 4 players, any board shape) | Built | `src/core` |
| 18 opening bots, own chess engine after the opening | Built | Bot Path |
| Bot Path (beat one to unlock the next) | Built | Play the bots |
| Online play by room code, share link, text it | Built | Play online |
| Online rooms for 3 and 4 players, fill empty seats with bots | Built (needs `wrangler deploy`) | Play online |
| Match score across rematches, material lead (+3) | Built | Online games, every game |
| Online chess clock (3, 5, 10 min or none) | Built (needs `wrangler deploy`) | Play online |
| Emotes, reconnect, bot takes over if someone leaves, rematch | Built | Play online |
| Win of the game / one fix with retry | Built | After every bot game |
| Miss map (what you keep missing) | Built | Steers Train mode alerts |
| Three-move goals | Built (5 goals) | Train mode |
| Badges | Partly (counted, no badge screen yet) | Saved on profile |
| Coins and shop | Built | Result card, Wardrobe |
| 14 piece skins, per army or per piece | Built | Wardrobe |
| 7 board landscapes | Built | Wardrobe |
| Capture/check/mate effects and sounds | Built | Every game |
| Profiles, ratings, saved games and replay | Built | Home, My games |
| Chess.com player lookup and game download | Built (relay needs `wrangler deploy`) | Chess.com corner |
| Chess.com daily puzzle with streak | Built | Puzzles |
| Chess.com random puzzle | Built | Puzzles |
| Full game analysis (every move graded, better move, graph) | Built | After any game, My games |
| Training wheels in online games (alerts, hints, goals; opponent may play unrated) | Built | Play online |
| All 2-player modes as online room games | Built | Play online |
| Built-in warm-up puzzles (work offline) | Built | Puzzles |
| Nemesis bot (plays like any Chess.com player) | Built (openings and strength) | Chess.com corner, Bot path |
| Blunder replay puzzles from your games | Built | Puzzles → 🔁 My slips (your games here, or a Chess.com username) |
| Opening trainer | Built | Home → 📖 Openings, and "Learn this opening" on every bot |
| Arcade duel mode | Planned | Later phase |
| Teacher dashboard, accounts | Not planned yet | Needs a privacy review |
| Pass-and-play | Removed (owner) | — |
| AI coach | Removed (owner: no AI) | — |

