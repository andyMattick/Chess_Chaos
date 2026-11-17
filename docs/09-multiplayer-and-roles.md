# 09. Multiplayer, 3 and 4 player chess, territory modes, hidden roles

Added after the first draft at the owner's request. Where this doc conflicts with an
earlier one, this doc wins.

## 1. Ways to play with other people

| Way | Players | Needs a server | Hidden information allowed |
|---|---|---|---|
| Pass-and-play | 2 to 4 on one device | No | No |
| Online room | 2 to 4, one device each | Yes | Yes |
| Against bots | 1 human plus 1 to 3 bots | No | Yes |
| Mixed online | Humans plus bots filling empty seats | Yes | Yes |

Multiplayer is a core feature, not an extra. The engine must support 2 to 4 seats from
phase 0 (section 3), even though online play arrives in phase 6.

## 2. Online rooms

### Player experience
- Host taps "Play with friends" and gets a 4-letter room code and a QR code.
- Others enter the code and a nickname. No accounts, no email, no friend lists.
- Host picks: party match or plain, number of seats, bots for empty seats, clock.
- No free-text chat. A fixed set of emotes and phrases only ("good move", "oops", "rematch?").
- If a player disconnects, their seat is held for 60 seconds, then a bot takes over until they return.
- Rooms are deleted when empty for 10 minutes.

### Architecture
- **Authoritative server.** The server runs the same `core/` engine as the client. Clients send
  actions; the server validates, applies, and sends each client a state filtered by that
  seat's `visibility`. Secret missions, hidden roles, hands and fogged squares never reach
  a client that should not see them.
- The match setup pipeline runs on the server with a server-chosen seed.
- Transport: WebSocket, one room per connection group. Messages: `join`, `setup-choice`
  (card hand, role picks), `action`, `emote`, `state`, `reveal`, `error`.
- The server is a small stateful service. It needs persistent connections, which plain
  static hosting does not provide. Choose a host that supports WebSocket rooms (for example
  a Durable-Object style edge runtime or a small always-on Node service). Evaluate cost and
  licence terms at the start of phase 6 and record the choice in doc 08.
- Shared code: `core/`, `tactics/`, `content/` and `systems/` are imported by both client and server. Keep them free of browser and Node specifics.
- Bots in online rooms run on the server.

### Ratings and collections online
- Profiles stay on the device. The client reports rating and chosen card hand at join time.
- This is open to tampering and is acceptable for play among friends and classmates.
  Public matchmaking and leaderboards would need accounts and are out of scope.
- The server reports the result; each client applies its own rating change and card burn.

### Safety
- No personal data stored on the server: nickname, seat, room code only, deleted with the room.
- Nicknames pass a block list. No user-generated text is shown to other players apart from the nickname.

## 3. Engine changes for 2 to 4 players

These replace the two-player assumptions in doc 04.

```ts
type PlayerId = 'p1' | 'p2' | 'p3' | 'p4';     // seats; 'white' and 'black' are display names for p1 and p2

interface Seat {
  id: PlayerId;
  forward: [number, number];                   // pawn direction as a vector
  homeRanks: Square[];                         // for "back rank", "second rank", promotion distance
  team?: 'A' | 'B';
  status: 'active' | 'eliminated';
}
```

- Turn order is a list of active seats, clockwise.
- Pawn patterns use the seat's `forward` vector. Promotion is defined as distance travelled from the home rank.
- "Opponent" in every rule, modifier, mission and detector becomes "any other seat that is not on my team".
- Board shapes are a width, a height and a blocked set, which already covers the cross-shaped board below.
- Evaluation and search: for 3 or 4 seats use a "max-n" search (each seat maximises its own score) at shallow depth, or paranoid search (assume all others oppose me). Start with paranoid at depth 2 to 3.

## 4. Three and four player chess

### Board
- 14 by 14 squares with a 3 by 3 block removed from each corner (160 squares).
- Each army starts on the two outer rows of one side, in the middle 8 files, in the normal arrangement.
- Three-player games use the same board with one side empty. (A dedicated three-sided board has awkward geometry; this keeps one board, one renderer and one set of rules.)

### Rules
- Turns go clockwise.
- **Kings are captured, not checkmated.** With more than two players the position changes
  before your next turn, so check is shown as a warning but is not enforced. A player whose
  king is captured is eliminated.
- When a player is eliminated, their remaining pieces turn grey and stay as obstacles. Grey pieces can be captured.
- Pawns promote after travelling 7 squares forward (reaching the eighth row from their own side).
- No en passant. Castling allowed as normal within a player's own rows.
- Last king standing wins. With a clock, a player who runs out of time is eliminated.

### Content in 3 and 4 player games
- Items are usable when they do not carry `needsStandardBoard` or `needsCheck`.
  Add a tag `twoPlayerOnly` to any item that names "the opponent" in a way that cannot be
  generalised (HCAP-11 Mirror, HCAP-15 Sleepy start, MISSION-11, MISSION-12).
- Rating modifiers: compare each player with the table's average rating and apply the gap table from doc 02.
- Missions: each player gets one; completing it wins the whole game.
- Cards: same rules, hand of 3.

## 5. New modes

| ID | Name | Players | Tier | Rules |
|---|---|---|---|---|
| MODE-25 | Mystery army | 2 | B | Each player gets a random army worth 39 points (king free), the same for both, placed on the first two ranks | 
| MODE-26 | Three-way | 3 | C | Section 4, three armies, free-for-all |
| MODE-27 | Four-way | 4 | C | Section 4, free-for-all |
| MODE-28 | Four-way teams | 4 | C | Section 4, partners sit opposite. A team loses when both its kings are captured. Partners' pieces cannot capture each other |
| MODE-29 | Hill wars | 2 to 4 | B | Territory king of the hill. The hill is the central 4 squares on the 8 by 8 board, or the central 16 on the four-player board. At the end of each full round every player scores 1 point per hill square they occupy, and 2 for a king. First to 20 points wins (30 with 3 or 4 players). Capturing a king still eliminates |
| MODE-30 | Paint the board | 2 to 4 | B | Every square a piece lands on turns that player's colour, replacing any previous colour. After 30 rounds the player with the most squares wins. Capturing a king removes that player's colour from the board |
| MODE-31 | Contract | 3 or 4 | C | Each player is secretly given one other player as a target. Capturing your target's king wins the game at once. If someone else captures your target's king, you inherit that target's contract. Replaces secret missions for this mode | 

MODE-29 and MODE-30 are in the mode deck for two-player party matches. MODE-26, 27, 28 and 31
are chosen when a room has 3 or 4 seats; the room's mode deck is drawn from modes that
support that seat count.

Two-player modes that also work on the four-player board with no rule changes:
MODE-01 Random piece, MODE-06 Capture race (highest score when the first king falls),
MODE-13 Atomic, MODE-21 Lava squares, MODE-22 Truce.

## 6. Hidden roles: assassins and saboteurs

A fourth layer in the party match, after missions and before card hands. In about half of
party matches (a coin flip at setup) every player receives **one role**; in the rest, nobody does. Roles are hidden information, so they are used only online and against bots.
A parent can switch roles off in settings. Roles unlock after 5 party matches.

| ID | Role | Rule |
|---|---|---|
| ROLE-01 | Assassin | Secretly mark one of your pawns. Once per game, instead of moving, it may capture any enemy piece on one of the 8 squares around it, except a king. It is revealed when it strikes and is then an ordinary pawn |
| ROLE-02 | Last pawn | When you are down to your final pawn it becomes a Champion, shown to everyone: it moves and captures like a king and still promotes. This role is open, not secret |
| ROLE-03 | Saboteur | Secretly mark one enemy pawn, knight or bishop. Once per game, on your turn, you make one move with that piece as if it were yours (it may capture its own side's pieces but not a king). It then leaves the board. This uses your move |
| ROLE-04 | Spy | Secretly mark one of your pawns. When it crosses the middle of the board you see one opponent's mission and card hand. It is revealed when that happens |
| ROLE-05 | Bodyguard | Secretly mark one of your pieces next to your king at the start. The first time your king would be captured or checkmated while that piece is on the board and adjacent, the piece is removed instead, the attacker returns to its square and play continues |
| ROLE-06 | Sleeper | Secretly mark one of your pawns. If it is captured, the capturing piece is frozen for its owner's next 2 turns |
| ROLE-07 | Turncoat | 3 or 4 players only. Secretly mark one piece (not a king or queen) belonging to the player on your left. If that player is eliminated, the piece joins your army instead of turning grey |
| ROLE-08 | Decoy | Secretly mark one of your pawns as bait. The first enemy piece that captures it is revealed to have "taken the bait": you immediately get one free extra move |

Rules for all roles:
- Marks are chosen during setup, with a 20 second timer and a sensible default.
- Bots receive roles and choose marks at random among sensible candidates.
- A role's mark is lost if the marked piece is captured before use (except where the rule says otherwise).
- Post-game reveals every role and what it did.
- Tags: all roles are `hiddenInfo` except ROLE-02. ROLE-01, 04, 06, 08 are `needsPawns`. ROLE-05 is `needsCheck` in two-player games.

These rules are a first design from the owner's one-line idea ("assassins and saboteurs,
maybe the last pawn"). The owner has approved them as a starting point; adjust after playtesting.

## 7. Hint budget

From the original tutor list and referenced by HCAP-10 and HCAP-23: in games where the
active alert is on-request (rating 1200 and over), the player has 3 hints. Unused hints at
the end of the game each count toward the "self-reliant" badge.
