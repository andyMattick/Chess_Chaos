# 02. Game systems

IDs refer to `03-content-catalog.md`.

## 1. Ratings

- Each profile has one rating. Start at 600. Standard Elo update, K = 32 for the first 30 games, then 16.
- Bots have fixed ratings.
- All game types against a rated opponent update the rating. Pass-and-play updates both profiles.
- A mission win moves ratings by half the normal amount for both players, so checkmate stays the skill that pays most.
- Solo challenges, puzzles and mini-games do not change the rating.

## 2. Alerts (training help)

- Exactly **one** alert is active per game and stays on for the whole game.
- Selection: weighted random from the alerts allowed for the player's band, with extra weight
  on alerts that train the top entry in the player's miss map. Never the same alert two games running.
- The player sees which alert is active at match setup ("This game: Danger squares").

| Rating band | Alert pool | Strength |
|---|---|---|
| Under 800 | All alerts | Always on, unlimited |
| 800 to 1199 | ALERT-05 to ALERT-10 (the alerts that make the player do the thinking) | Always on, unlimited |
| 1200 and over | ALERT-05 to ALERT-10 | On request only, 3 uses per game |

- Alerts are on by default in training games, optional in bot games, off in party matches
  unless the player is under 800.

## 3. Mode rotation ("different game type each time")

- Each profile has a **mode deck**: the list of unlocked match modes, shuffled.
- Each party match draws the top mode. When the deck is empty it is reshuffled, with the
  constraint that the first draw differs from the last mode played.
- MODE-00 (standard chess) is in the deck three times, so about one match in four early on is real chess.
- Unlocks: tier A modes from the start, tier B after 10 party matches, tier C after 25.
- Solo challenge modes (MODE-11, MODE-12) are not in the deck; they are launched from the menu.
- In pass-and-play, the deck used belongs to the lower-rated player, and hidden-information
  modes are skipped.

## 4. Modifiers ("triggered by ratings")

The rating gap between the two players decides who gets what. The lower-rated player is the
underdog; the higher-rated player is the favourite.

| Gap | Underdog receives | Favourite receives |
|---|---|---|
| 0 to 99 | nothing | nothing |
| 100 to 199 | 1 minor buff | nothing |
| 200 to 299 | 1 major buff | nothing |
| 300 to 399 | 1 major buff | 1 minor handicap |
| 400 to 499 | 1 major buff, 1 minor buff | 1 minor handicap |
| 500 or more | 1 major buff, 1 minor buff | 1 major handicap |

- Modifiers are drawn at random from the items compatible with the current mode and opponent type (section 7).
- Both players see all modifiers at match setup. Modifiers are not secret.
- Training games and plain bot games: the underdog receives buffs from the table; nobody receives handicaps.
- **Passive** modifiers apply all game. **One-shot** buffs are a button the player presses once.
  Activating a one-shot buff does not use the player's move unless the catalog says so.
  One buff activation per turn.
- A bot can be the underdog or the favourite. Bots use passive buffs and suffer rules-level
  handicaps. Items tagged `humanOnly` are never given to bots.

## 5. Secret missions ("a mission that ends the game")

- At match setup each player is dealt one mission from the game-ending pool. Each player sees only their own.
- **Completing your mission wins the game immediately.** The result is recorded as a "mission win".
  Checkmate and the mode's own win condition still win as normal; whichever happens first ends the game.
- **Gate:** missions go live after each player has made 10 moves. An event that happens
  earlier does not count. For state-based missions, the state must be newly reached or still
  true at the end of the player's own move 11 or later. The UI shows "missions are live" at that point.
  If either player is rated under 800, the gate is move 8 instead (their games are shorter).
- **Difficulty by rating:** if the gap is under 200, both players draw from the Medium pool.
  If the gap is 200 or more, the underdog draws Medium and the favourite draws Hard.
- The two players never receive the same mission.
- A mission whose conditions cannot be met in the current mode is excluded (section 7).
- Bots receive missions too. The AI adds an evaluation bonus for progress toward its own
  mission and does not know the human's mission.
- Post-game reveals both missions.

Mission categories in the catalog:

| Category | Use |
|---|---|
| Medium, Hard | Game-ending pool for party matches |
| Easy | Not game-ending. Shown openly in training games as three-move goals; completing one awards progress toward badges |
| Bonus | Resolved at game end (for example "win without losing your queen"). Awards a card pick. Never ends the game. Each party match has a 1 in 3 chance of adding one bonus objective per player, shown openly |

## 6. Cards ("played once, then burned")

- Cards are power pieces or piece effects. Each profile has a **collection**.
- **Earning:** each card has an earn condition (catalog). Meeting it adds one copy to the collection. Conditions can be met repeatedly; at most one copy of the same card is earned per game.
- **Hand:** before a party match each player picks up to 3 cards from their collection. No duplicates in a hand.
- **Playing:** one card per turn, on the player's own turn.
  - *Upgrade* cards transform one of the player's pieces of the listed base type. Playing the card **is** the player's move for that turn.
  - *Summon* cards place a new object on the board. Playing the card is the player's move.
  - *Effect* cards resolve immediately and do not use the move, unless the catalog says so.
  - A card cannot be played if the resulting position leaves the player's own king in check.
- **Burning:** a played card is removed from the collection permanently. Cards in hand that were not played return to the collection.
- **Rarity** (Common, Rare, Epic) is display only in v1 and reflects power.
- Bots rated 1000 or more carry one signature card (see `05-bots.md`). Other bots hold none.
- Cards are disabled in training games and plain bot games.

## 7. Compatibility tags

Every content item declares tags. Match setup filters each pool so that only compatible
items can be drawn. No special cases in code.

| Tag | Meaning | Excluded when |
|---|---|---|
| `needsCastling` | Refers to castling | Mode disables castling (shuffle start, mini board, racing kings, horde side) |
| `needsPawns` | Refers to pawns or promotion | Mode has no pawns for that player (racing kings) |
| `needsStandardBoard` | Assumes 8x8 with fixed geometry | Mini board, shrinking board, wrap-around |
| `needsStandardArmy` | Assumes the normal starting army | Horde, draft, monster, boss battle, mystery armies |
| `needsCheck` | Relies on check and checkmate | Giveaway |
| `needsClock` | Only meaningful with a clock | Untimed games |
| `needsHints` | Spends or grants hints | No alert active |
| `needsMissions` | Refers to missions | Missions disabled |
| `hiddenInfo` | One player must not see something | Pass-and-play on one device |
| `humanOnly` | Affects only what a human sees or how they input moves | Recipient is a bot |
| `needsQueen`, `needsRooks`, `needsBishops`, `needsKnights` | Refers to that piece type | Player starts without it |

Modes declare the capabilities they remove. An item is compatible when none of its tags are removed.

## 8. Rewards

After every game:

| Trigger | Reward |
|---|---|
| Any rated game | Rating update |
| Card earn condition met | One copy of that card |
| Bonus objective completed | Choice of one card from three random Commons |
| Tactic detector fired for the player | Progress toward that badge |
| Easy mission completed in training | Progress toward the "goal getter" badge |
| Every third game finished by a player rated under 800 | One random Common card, so beginners always have something to play |

## 9. Game end reasons

`checkmate`, `mode-win` (mode specific), `mission`, `resign`, `time`, `stalemate`,
`draw-repetition`, `draw-50`, `draw-material`, `draw-agreed`.
Each mode may redefine stalemate and insufficient material (for example, giveaway).
