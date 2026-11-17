# 03. Content catalog

Every item has a stable ID. Tags are defined in `02-game-systems.md`, section 7.
Where a rule here was tightened from the original brainstorm, the wording here wins.

Counts: 10 alerts, 25 modes, 24 buffs, 24 handicaps, 24 missions, 24 cards, 9 mini-games.
Seven further modes (MODE-25 to MODE-31, including 3 and 4 player chess and the territory
modes) and eight hidden roles (ROLE-01 to ROLE-08) are in `09-multiplayer-and-roles.md`.

---

## Alerts

One per game, always on (see `02-game-systems.md`, section 2).

| ID | Name | Behaviour | Engine needs |
|---|---|---|---|
| ALERT-01 | Danger squares | Tint every square the opponent attacks | Attack map |
| ALERT-02 | Hanging alarm | The player's attacked and under-defended pieces wobble | Exchange evaluation |
| ALERT-03 | Best piece glow | Highlight the piece that has the best move; the player finds the square | Search |
| ALERT-04 | Best square glow | Highlight the best destination square; the player finds the piece | Search |
| ALERT-05 | Pick from three | Offer three moves: best, acceptable, losing. The player chooses | Search, multi-line |
| ALERT-06 | Hot and cold | While a piece is held over a square, tint the board warm or cool by evaluation change | Search per candidate |
| ALERT-07 | Name the idea | Show one word ("fork", "pin", "free piece") when that tactic is available | Tactic detectors |
| ALERT-08 | What does that move want? | After the opponent moves with a threat, the player must tap the threatened piece or square before replying | Threat detection |
| ALERT-09 | Second look | If the chosen move loses 2 or more points of material, ask "that piece is in danger, can you see why?" and allow one retry per move | Search |
| ALERT-10 | Count the fight | On contested squares show attacker count against defender count | Attack map |

---

## Game modes

Tier A: small rule change. Tier B: engine work. Tier C: geometry change or hidden information.
"Removes" lists capabilities the mode takes away (for compatibility filtering).

| ID | Name | Tier | Rules | Removes |
|---|---|---|---|---|
| MODE-00 | Standard | A | Normal chess | none |
| MODE-01 | Random piece | A | Each turn a die picks a piece type from those that have a legal move; the player must move that type. If the player is in check, any legal move is allowed | none |
| MODE-02 | King of the hill | A | Normal chess, plus: a king that reaches d4, d5, e4 or e5 wins | none |
| MODE-03 | Three-check | A | Normal chess, plus: giving a third check wins | none |
| MODE-04 | Horde | B | White has 36 pawns and no king; Black has a normal army. Black wins by capturing every pawn; White wins by checkmate | needsStandardArmy, needsCastling (White) |
| MODE-05 | Shuffle start | A | Back rank randomised, mirrored for both sides, bishops on opposite colours. Castling disabled | needsCastling |
| MODE-06 | Capture race | A | First player to capture 15 points of material wins (pawn 1, knight 3, bishop 3, rook 5, queen 9). Checkmate also wins | none |
| MODE-07 | Draft | B | Each player has 30 points to buy pieces (king free), picking alternately, then places them on their first two ranks | needsStandardArmy, needsCastling |
| MODE-08 | Boss battle | B | One side has a full army. The boss side has a king and one Boss piece (moves as queen plus knight) with 3 lives; when captured it returns to its home square, or the nearest empty square, until its lives run out. The army wins by removing all 3 lives or by checkmate; the boss side wins by checkmate. The lower-rated player takes the army | needsStandardArmy |
| MODE-09 | Shrinking board | B | After every 10 full moves the outermost ring of squares is removed, down to a 4x4 minimum. A warning shows 2 moves ahead. Pieces left on removed squares are lost; a king left there loses the game | needsStandardBoard, needsCastling |
| MODE-10 | Tag team | A | Two humans per side alternate moves without talking. Pass-and-play only | none |
| MODE-11 | Puzzle gauntlet | Solo | Three lives, puzzles of rising difficulty. Not in the mode deck | n/a |
| MODE-12 | Endgame survival | Solo | Hold a draw for 20 moves from a set endgame position. Not in the mode deck | n/a |
| MODE-13 | Atomic | B | Every capture explodes: the capturing piece, the captured piece and all non-pawn pieces on the 8 surrounding squares are removed. Exploding the enemy king wins. Kings cannot capture | none |
| MODE-14 | Drop-in | B | A captured piece changes sides and goes into the capturer's reserve. A turn may be used to drop a reserve piece on any empty square. Pawns cannot be dropped on the first or last rank. Promoted pieces revert to pawns when captured | none |
| MODE-15 | Giveaway | B | Capturing is compulsory when possible. The king has no special status. A player with no pieces, or no legal move, wins | needsCheck, needsCastling |
| MODE-16 | Racing kings | B | No pawns. Both armies start on the first two ranks. Giving check is illegal. First king to the eighth rank wins; if White arrives first, Black gets one reply to draw by also arriving | needsPawns, needsCastling, needsStandardArmy |
| MODE-17 | Progressive | B | White makes 1 move, Black 2, White 3, and so on. Giving check ends the sequence at once. A player in check must escape with the first move of the sequence | none |
| MODE-18 | Wrap-around | C | The a-file and h-file are joined: pieces move off one side and continue on the other. Castling disabled | needsStandardBoard, needsCastling |
| MODE-19 | Hidden queen | C | Each player secretly marks one pawn. That pawn may move as a queen; the first time it does, it is revealed | hiddenInfo |
| MODE-20 | Capture the flag | A | Each side has a flag square on its own back rank, chosen at random from files c to f and shown to both. Moving a non-pawn piece onto the enemy flag and surviving the opponent's next move wins. Checkmate also wins | none |
| MODE-21 | Lava squares | B | Every 5 full moves, 3 random empty squares become lava for the next 5 full moves. Pieces cannot enter or pass through lava; knights may jump over | none |
| MODE-22 | Truce | A | No captures by either side for each player's first 10 moves | none |
| MODE-23 | Mini board | B | 5x5 board. Back rank: rook, knight, bishop, queen, king. One row of pawns. No double pawn step, no castling | needsStandardBoard, needsCastling |
| MODE-24 | Monster | B | White has a king and pawns on c2, d2, e2, f2 and makes two moves every turn. Black has a normal army. Checkmate wins; White's king may not end its turn in check | needsStandardArmy, needsCastling (White) |

---

## Buffs (positive modifiers)

Type P = passive all game. Type O = one-shot, activated once by the player.
Tier decides when it is dealt (see the rating gap table).

| ID | Name | Type | Tier | Rule | Tags |
|---|---|---|---|---|---|
| BUFF-01 | Double step | O | Major | One of your pieces moves twice this turn. This is your move. The position must be legal after the second move | |
| BUFF-02 | Shield | O | Major | Choose one of your pieces (not the king). It cannot be captured for the opponent's next 2 turns | |
| BUFF-03 | Take-back | O | Minor | Undo your last move and the opponent's reply | |
| BUFF-04 | Scout | O | Minor | Before you commit a move, see the opponent's best reply to it | humanOnly |
| BUFF-05 | Pawn sprint | P | Minor | Your pawns may advance two squares on any turn if both squares are empty. No en passant against sprint moves beyond the second rank | needsPawns |
| BUFF-06 | Second wind | P | Major | The first non-queen piece you lose returns to its home square if that square is empty; otherwise the nearest empty square on your back rank | needsStandardArmy |
| BUFF-07 | Long jump | P | Major | Your knights may also leap three squares in one direction and one sideways | needsKnights |
| BUFF-08 | Early crown | P | Major | Your pawns promote on reaching the seventh rank | needsPawns, needsStandardBoard |
| BUFF-09 | Safe king | P | Minor | The first time a move gives you check, the checking piece is sent back to the square it came from and the opponent's turn ends | needsCheck |
| BUFF-10 | Backpedal | P | Minor | Each of your pawns may step one square straight backward once per game | needsPawns |
| BUFF-11 | Swap | O | Minor | Exchange the positions of two of your own pieces (not the king). This is your move | |
| BUFF-12 | Bonus hint | O | Minor | One free use of best piece glow | humanOnly |
| BUFF-13 | Rally | O | Major | Activate after making a capture: move a second, different piece this turn | |
| BUFF-14 | Reinforcements | O | Minor | Place a new pawn on an empty square of your second rank. This is your move | needsPawns |
| BUFF-15 | Freeze ray | O | Minor | Choose one enemy piece (not the king). It cannot move on the opponent's next turn | |
| BUFF-16 | Royal dash | O | Minor | Your king may move two squares in a straight line this turn, not through or into check | |
| BUFF-17 | Sidestep | O | Minor | One of your pawns moves one square sideways onto an empty square. This is your move | needsPawns |
| BUFF-18 | Knight's blessing | O | Major | Any one of your pieces (not the king) makes a knight move this turn. This is your move | |
| BUFF-19 | X-ray | O | Minor | For your next 3 turns, see attacker and defender counts on every contested square | humanOnly |
| BUFF-20 | Recall | O | Minor | Send one of your pieces back to its home square if that square is empty. This is your move | needsStandardArmy |
| BUFF-21 | Home guard | O | Minor | Your pieces on your back rank cannot be captured on the opponent's next turn | |
| BUFF-22 | Time bank | O | Minor | Add 30 seconds to your clock | needsClock, humanOnly |
| BUFF-23 | Peek | O | Minor | Reveal the opponent's secret mission to you | needsMissions, hiddenInfo, humanOnly |
| BUFF-24 | Safety net | O | Minor | The next time you choose a move that loses 2 or more points of material, you are warned and may choose again | humanOnly |

---

## Handicaps (negative modifiers)

All handicaps are passive for the whole game unless a duration is given.

| ID | Name | Tier | Rule | Tags |
|---|---|---|---|---|
| HCAP-01 | Fog | Major | You see only squares your pieces occupy or can move to | hiddenInfo, humanOnly |
| HCAP-02 | Frozen piece | Minor | One random non-king, non-pawn piece of yours cannot move for your first 3 turns | |
| HCAP-03 | Tired queen | Minor | Your queen moves at most 3 squares | needsQueen |
| HCAP-04 | Butterfingers | Minor | Touch-move: once you pick up a piece that has a legal move, you must move it | humanOnly |
| HCAP-05 | Slow pawns | Minor | Your pawns have no two-square first move | needsPawns |
| HCAP-06 | No castling | Minor | You may not castle | needsCastling |
| HCAP-07 | Short clock | Major | You have 10 seconds per move; on timeout a random legal move is played | humanOnly |
| HCAP-08 | Blind spot | Major | One random file is hidden from you for the whole game | hiddenInfo, humanOnly, needsStandardBoard |
| HCAP-09 | Heavy rooks | Minor | Your rooks cannot move before your move 10 (castling is still allowed) | needsRooks |
| HCAP-10 | Tax | Minor | Each capture you make costs one hint; with no hints left there is no cost | needsHints, humanOnly |
| HCAP-11 | Mirror | Major | If you have a legal move with the same piece type your opponent just moved, you must move that type. Does not apply while you are in check | |
| HCAP-12 | Homesick king | Minor | Your king may not leave your first two ranks | needsStandardBoard |
| HCAP-13 | Forced capture | Major | If you can capture, you must (your choice of capture) | |
| HCAP-14 | Missing pawn | Minor | You start without one random pawn | needsPawns, needsStandardArmy |
| HCAP-15 | Sleepy start | Minor | Your opponent makes two moves before your first move (the second may not capture or give check) | |
| HCAP-16 | Silent board | Minor | No legal-move dots, last-move highlight or check highlight for you | humanOnly |
| HCAP-17 | Rusty crown | Minor | Your pawns promote only to knights | needsPawns |
| HCAP-18 | Slippery board | Major | Your rooks, bishops and queen must travel as far as they can in the chosen direction, stopping at the first capture | |
| HCAP-19 | One-way rooks | Major | Your rooks move only along files | needsRooks |
| HCAP-20 | Peaceful bishops | Major | Your bishops cannot capture | needsBishops |
| HCAP-21 | Costume party | Major | Enemy pieces all look identical to you until each one first moves | hiddenInfo, humanOnly |
| HCAP-22 | Restless king | Major | On every fifth turn of yours, you must move your king if it has a legal move | |
| HCAP-23 | Toll road | Minor | Moving onto d4, d5, e4 or e5 costs you one hint; with no hints left there is no cost | needsHints, humanOnly, needsStandardBoard |
| HCAP-24 | No take-backs | Minor | You cannot use Take-back or the Second look retry | humanOnly |

---

## Secret missions

Category rules are in `02-game-systems.md`, section 5. Detection definitions are binding;
each needs FEN fixture tests.

| ID | Mission | Category | Detection | Tags |
|---|---|---|---|---|
| MISSION-01 | Castle before move 8 | Easy | Player castles on or before their move 8 | needsCastling |
| MISSION-02 | Capture with a knight | Easy | A knight of the player makes a capture | needsKnights |
| MISSION-03 | Win without losing your queen | Bonus | Player wins and their original queen was never captured | needsQueen |
| MISSION-04 | Promote a pawn | Hard | Player promotes | needsPawns |
| MISSION-05 | Deliver a fork | Medium | After the player's move one piece attacks two or more enemy pieces that are each worth more than it or undefended, and the player wins material within 2 moves | |
| MISSION-06 | Pin a piece to the king | Medium | After the player's move an enemy piece cannot legally move off a line because the player's bishop, rook or queen would then attack the enemy king, and the pin was created by that move | needsCheck |
| MISSION-07 | Rook on the seventh | Medium | A rook of the player stands on the opponent's second rank and is not captured on the reply | needsRooks, needsStandardBoard |
| MISSION-08 | Nothing left hanging | Easy | For 5 consecutive turns the player ends the turn with no piece that loses material to a capture | |
| MISSION-09 | Mate with a minor piece | Bonus | Checkmate delivered by a knight or bishop move | needsCheck |
| MISSION-10 | Own the centre | Medium | At the end of the player's move, the player occupies at least two of d4, d5, e4, e5 and attacks or occupies all four | needsStandardBoard |
| MISSION-11 | Trade queens while ahead | Medium | Queens are exchanged within two moves while the player is ahead by 2 or more points of material | needsQueen |
| MISSION-12 | Check three times | Medium | Player gives a third check | needsCheck |
| MISSION-13 | Develop the minors | Easy | By the player's move 10, all four knights and bishops have left their starting squares | needsStandardArmy |
| MISSION-14 | Discovered attack | Hard | The player moves a piece off a line, opening an attack from a piece behind it, and wins material within 2 moves | |
| MISSION-15 | Land a skewer | Hard | The player attacks a valuable piece along a line, it moves away, and the player captures the piece behind it | |
| MISSION-16 | En passant | Hard | Player captures en passant | needsPawns |
| MISSION-17 | Passed pawn | Medium | The player has a pawn on the fifth rank or beyond with no enemy pawn ahead of it on its own or adjacent files | needsPawns, needsStandardBoard |
| MISSION-18 | Double their pawns | Medium | A capture forced by the player's move leaves the opponent with two pawns on one file that were not doubled before | needsPawns |
| MISSION-19 | Keep the bishop pair | Medium | Player still has both bishops at the end of their move 20 | needsBishops |
| MISSION-20 | Back-rank mate | Bonus | Checkmate by a rook or queen on the opponent's back rank with the king hemmed in by its own pieces | needsCheck |
| MISSION-21 | Knight outpost | Medium | A knight of the player is on the fifth or sixth rank, defended by a pawn, and no enemy pawn can ever attack its square | needsKnights, needsPawns, needsStandardBoard |
| MISSION-22 | Connect the rooks | Easy | Both of the player's rooks are on the back rank with no piece between them | needsRooks |
| MISSION-23 | Stack the rooks | Medium | Both of the player's rooks are on the same file and that file has no pawns of either colour | needsRooks |
| MISSION-24 | Sacrifice and win | Bonus | Player gives up a piece for less material, does not win it back within 3 moves, and wins the game | |

Pools: Easy 5 (01, 02, 08, 13, 22). Medium 11 (05, 06, 07, 10, 11, 12, 17, 18, 19, 21, 23).
Hard 4 (04, 14, 15, 16). Bonus 4 (03, 09, 20, 24).

---

## Cards (power pieces)

Kind: Upgrade (transforms one of your pieces; uses your move), Summon (places something;
uses your move), Effect (resolves at once; does not use your move unless stated).
An upgraded piece keeps its new form until captured unless a duration is given.
Piece values are for the AI's evaluation.

| ID | Name | Kind | Base | Value | Rarity | Rule | Earn condition | Tags |
|---|---|---|---|---|---|---|---|---|
| CARD-01 | Chancellor | Upgrade | Rook | 8 | Rare | Moves as rook or knight | Win a game in which your rook reached the seventh rank | |
| CARD-02 | Archbishop | Upgrade | Bishop | 7 | Rare | Moves as bishop or knight | Win a game still holding both bishops | |
| CARD-03 | Amazon | Upgrade | Queen | 12 | Epic | Moves as queen or knight. Reverts to a queen after its first capture | Win 3 rated games in a row | |
| CARD-04 | Super pawn | Upgrade | Pawn | 3 | Common | Moves and captures one square in any direction. Cannot promote | Promote a pawn | |
| CARD-05 | Jumper rook | Upgrade | Rook | 6 | Rare | Moves as a rook and may pass over one piece per move | Connect your rooks by move 12 in 3 games | |
| CARD-06 | Ghost bishop | Upgrade | Bishop | 4 | Common | Moves as a bishop and passes through your own pieces | Pin a piece to the king (MISSION-06 detector) | |
| CARD-07 | Nightrider | Upgrade | Knight | 5 | Rare | Repeats its knight leap in a straight line until blocked | Win material with a knight fork | |
| CARD-08 | Bodyguard | Upgrade | Knight or bishop | 4 | Common | For your next 5 turns, your pieces on the 8 squares around it cannot be captured | Play 10 moves in a row with nothing hanging | |
| CARD-09 | Cannon | Upgrade | Rook | 4 | Common | Moves as a rook. Captures only by jumping exactly one piece along the line | Win material with a discovered attack | |
| CARD-10 | Wall | Summon | none | n/a | Common | Place a blocker on an empty square in your half. It cannot be captured or passed and vanishes after 3 of your turns | Win or draw a game after being 3 or more points behind | |
| CARD-11 | Teleporter | Effect | Any non-king | n/a | Rare | Move one of your pieces to any empty square. It may not give check. Uses your move | Complete the knight maze mini-game (before phase 8: win a game with a knight capture of a rook or queen) | |
| CARD-12 | Twin | Effect | Rook or knights | n/a | Common | Turn a rook into two knights (the second on an adjacent empty square), or two knights into one rook on either knight's square. Uses your move | Win a Draft game | |
| CARD-13 | Camel | Upgrade | Knight | 3 | Common | Leaps three squares in one direction and one sideways, instead of the knight leap | Win a Random piece game | |
| CARD-14 | Grasshopper | Upgrade | Pawn | 2 | Common | Moves along queen lines but must hop over exactly one piece and land on the square just beyond it | Win a Mini board game | |
| CARD-15 | Dragon rook | Upgrade | Rook | 7 | Rare | Moves as a rook or one square diagonally | Deliver checkmate with a rook | |
| CARD-16 | Dragon bishop | Upgrade | Bishop | 5 | Rare | Moves as a bishop or one square orthogonally | Complete Own the centre (MISSION-10 detector) | |
| CARD-17 | Lance | Upgrade | Pawn | 3 | Common | Moves and captures straight forward any distance. Cannot retreat or promote | Create a passed pawn in 3 games | |
| CARD-18 | Phoenix | Effect | Any non-king | n/a | Rare | Mark one of your pieces. The first time it is captured it returns to its home square if empty, otherwise it is lost | Win a game after losing your queen | needsStandardArmy |
| CARD-19 | Bomb pawn | Effect | Pawn | n/a | Common | Mark one of your pawns. When it is captured, the capturing piece is removed too (not a king) | Win an Atomic game | |
| CARD-20 | Magnet | Effect | none | n/a | Common | Choose one of your pieces and an enemy piece on the same rank, file or diagonal with empty squares between. The enemy piece moves one square closer. Not a king | Land a skewer (MISSION-15 detector) | |
| CARD-21 | Battering ram | Effect | Rook | n/a | Common | An enemy piece orthogonally next to one of your rooks is pushed one square directly away if that square is empty. Not a king | Stack your rooks on an open file | |
| CARD-22 | Medic | Effect | Bishop | n/a | Rare | Return one of your captured pawns to an empty square next to one of your bishops. Not on the first or last rank | Win a Pawn wars mini-game (before phase 8: win a game having lost 2 or fewer pawns) | |
| CARD-23 | Decoy king | Summon | none | n/a | Epic | Place a fake king next to your king. The opponent cannot tell them apart. The decoy moves as a king; capturing it has no effect on the game | Complete 10 secret missions | hiddenInfo |
| CARD-24 | Guard | Upgrade | Pawn | 3 | Common | Moves and captures as a king but has no royal status. Cannot promote | Castle by move 8 in 5 games | |

Implementation notes:
- "Home square" means the square the piece started the game on.
- Marks from CARD-18 and CARD-19 are visible to both players.
- When a card's base piece is not available to the player, the card cannot be played.

---

## Tutor mini-games (phase 8)

| ID | Name | Skill | Rule |
|---|---|---|---|
| MINI-01 | Pawn wars | Pawn play | Pawns only; first to promote wins |
| MINI-02 | Piece mazes | Piece movement | Reach the star in the fewest moves with one piece |
| MINI-03 | Capture the candy | Planning | One piece collects every target in the fewest moves |
| MINI-04 | Checkmate ladder | Basic mates | Queen and king, then two rooks, then rook and king |
| MINI-05 | Mate in one sprint | Pattern recognition | As many mates in one as possible in 60 seconds |
| MINI-06 | Guard duty | Defence | Defend every attacked piece with one move |
| MINI-07 | Trade or no trade | Exchange counting | Decide quickly whether an exchange wins material |
| MINI-08 | Spotlight | Calculation | The app picks a random piece; find its best move |
| MINI-09 | Handicap ladder | Confidence | The bot starts without a queen; pieces return as the player wins |
