# 05. Bots

Bots are not trained models. Each bot is an **opening book** plus the shared AI at a set
strength, plus a personality (name, avatar, lines of kid-friendly banter).

## How a bot chooses a move

1. If the current position is in the bot's book, play a book move (weighted random among the listed replies).
2. Otherwise run the AI with the bot's strength settings.
3. Books apply only in MODE-00 and modes that start from the standard position with standard rules for the opening phase (KOTH, three-check, capture race, capture the flag, truce, lava squares). In other modes the bot goes straight to the AI.

## Book format

```json
{
  "id": "london",
  "asWhite": [ { "line": "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2", "weight": 3 } ],
  "asBlack": [ { "line": "e4 e5 Nf3 Nc6 Bc4 Bc5", "weight": 1 } ]
}
```

Lines are compiled at load into a map from position key to weighted moves, so
transpositions are handled. Each bot needs its signature opening as the colour that plays it,
a simple companion repertoire for the other colour, and replies to the 3 or 4 most common
deviations by a beginner, 8 to 12 moves deep. Write the lines by hand from well-known theory
and verify every line is legal with a test.

## Strength settings

| Rating | Depth | Chance of a deliberate weak move | Notes |
|---|---|---|---|
| 400 | 1 | 35% | Often leaves pieces hanging; never refuses a free queen |
| 600 | 2 | 25% | |
| 800 | 2 | 15% | |
| 1000 | 3 | 10% | |
| 1200 | 3 | 5% | Quiescence on |
| 1400 | 4 | 2% | Quiescence on |

A "weak move" is drawn from moves ranked 3rd to 6th, never one that allows mate in 1.
These numbers are starting values. Calibrate by self-play between adjacent bots (the
stronger should score about 64%) and adjust.

## Roster

| ID | Name | Rating | Signature opening | Companion for the other colour | Personality |
|---|---|---|---|---|---|
| BOT-01 | Pip | 400 | Italian Game, quiet lines | Mirrors with ...e5 | Brand new, cheerful, narrates its own moves |
| BOT-02 | Sam the Scholar | 500 | Early queen attack (Qh5 and Bc4 ideas) | ...e5 and copies | Tries the four-move mate every game; teaches defence |
| BOT-03 | Lola London | 600 | London System | ...d5 solid setups | Builds the same house every time |
| BOT-04 | Captain Fork | 700 | Four Knights | Petrov-style ...Nf6 | Loves knights, shouts "fork!" |
| BOT-05 | Fred | 800 | Fried Liver Attack and Two Knights | ...e5 | Aims everything at f7 |
| BOT-06 | Sven | 800 | Scandinavian Defence (as Black) | Centre Game as White | Queen out early, unbothered |
| BOT-07 | Gus Gambit | 900 | King's Gambit | Accepts every gambit | Gives pawns away for fun |
| BOT-08 | Dana | 900 | Danish Gambit | Scotch-style ...exd4 | Two pawns down, all smiles |
| BOT-09 | Scotty | 900 | Scotch Game | ...e5 | Opens the centre early |
| BOT-10 | Vi | 1000 | Vienna Game and Gambit | ...e5 with ...Nf6 | Sneaky f-pawn |
| BOT-11 | Queenie | 1000 | Queen's Gambit | Queen's Gambit Declined | Patient, loves the c-file |
| BOT-12 | Madame Baguette | 1000 | French Defence (as Black) | Advance setups as White | Pawn chains and counterpunches |
| BOT-13 | Caro | 1100 | Caro-Kann (as Black) | Exchange setups as White | Careful, never rushes |
| BOT-14 | Ruy | 1100 | Ruy Lopez | Open ...e5 defences | Old-school sailor, slow squeeze |
| BOT-15 | Sal | 1200 | Sicilian Defence (as Black) | Alapin as White | Fights for the centre from the side |
| BOT-16 | Dutch | 1200 | Dutch Defence (as Black) | Bird's Opening as White | f-pawn first, always |
| BOT-17 | Indy | 1300 | King's Indian Defence (as Black) | King's Indian Attack as White | Lets you take the centre, then strikes |
| BOT-18 | Professor English | 1400 | English Opening | Symmetrical ...c5 | Quiet, positional, final boss |

All names and characters are original. Avatars are simple original illustrations.

## Bot card on the roster screen

Name, avatar, rating, "plays the ___", one-line tip for beating it, the player's record,
and a "learn this opening" button that opens the opening trainer (phase 8).

## Nemesis bot

Built from Chess.com data; see `06-chesscom-integration.md`.

## In party matches

Bots receive missions and rating-based modifiers. Bots rated 1000 or more carry one
signature card, played when the AI judges it improves the position by a point or more.

| Bot | Signature card |
|---|---|
| Vi | CARD-06 Ghost bishop |
| Queenie | CARD-03 Amazon |
| Madame Baguette | CARD-10 Wall |
| Caro | CARD-08 Bodyguard |
| Ruy | CARD-15 Dragon rook |
| Sal | CARD-16 Dragon bishop |
| Dutch | CARD-17 Lance |
| Indy | CARD-02 Archbishop |
| Professor English | CARD-01 Chancellor |
