# 12. Bot playtest of the modes (2026-11-18)

`bun scripts/simulate-modes.ts [games] [rating] [modes]` plays bot against bot (★800 both sides) and reports wins by side, draws, stalls (no result after 150 moves), crashes, length, captures, checks and lead changes. No AI service; it is the game's own engine.

## What was broken, and the fix

| Mode | Before | Problem | Fix | After |
|---|---|---|---|---|
| Shrinking board | 28 of 30 drawn, always 10 moves | Both kings start on the edge that falls at move 10, so both lose | Edge falls every 15 moves; a king on a falling square jumps to the nearest free square inside | 5 W / 9 B / 2 draws, 31 moves |
| Racing kings | 0 W / 13 B / 17 draws | Bots did not know the goal and shuffled until the 50-move rule | Bots score their king's height up the board | 7 W / 8 B / 1 draw, 28 moves |
| Monster | 0 W / 20 B / 10 draws | King + 4 pawns was hopeless even moving twice; bots did not plan the double move | Monster side gets 8 pawns; bots search with the mode's rules and one extra ply for the double move; no repetition draws | 8 W / 7 B / 1 draw |
| Progressive | 18 of 30 drawn by repetition | Positions repeat inside one long turn | No repetition draws in Progressive (and Monster) | 11 W / 13 B / 0 draws, 11 moves |
| Atomic | 23 W / 7 B, 10 moves | Bots could not see explosions | Bots now search every mode with its after-move rules (explosions, drops, double moves, Boss lives, mode wins) | 9 W / 15 B, 19 moves |
| Boss battle | Boss side won 2 of 21 | King + Boss alone against a full army | The Boss side keeps its pawns | Boss 5 / army 10 (the Boss is the stronger player, so this is the handicap) |
| Mystery army | 18 W / 7 B, one game over in 2 moves | Armies with no pawns left the king open | Mystery armies always include 5 pawns | 9 W / 11 B / 4 draws |
| Dice chess | 4 stalemates in 30 | The dice could pick a piece whose only moves were illegal (pinned) | Only roll kinds with a legal move | Still drawish (about half), see below |
| Hidden queen | (script could not run it) | | | 9 W / 4 B / 3 draws |
| Any mode that changes the board | rare crash | A remembered move from a different board could be suggested | The bot only returns a move that is legal right now | |

## Fine as they are

Classic, King of the hill, Hill wars, Three-check, Capture race, Truce, Capture the flag, Shuffle, Wrap-around, Giveaway, Lava, Mini board, Horde, Drop-in, Draft and Card chess were within normal White/Black swings over 24–30 games, with few draws and no stalls. Hill wars (17 moves), Capture race (21), Three-check (25) and Mini board (21) are the quickest; Horde (75) and Dice chess (70) the longest.

## Still to watch

- **Dice chess** ends in a draw about half the time between bots (stalemate, bare kings, 50-move rule): the dice keeps stopping the winning side from finishing. Humans may finish more often; a possible fix is to let the dice pick from any piece once only kings and one other piece are left.
- **Drop-in** and **Boss battle** bots think longer (drops and the Boss's extra moves give many choices).
- These are bots at ★800. Kids will play differently, so watch real games too.
