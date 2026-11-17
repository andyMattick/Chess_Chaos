# 04. Engine architecture

The app cannot use an off-the-shelf chess library for rules, because modes, modifiers and
cards change the board, the pieces and the win conditions. The engine is written in this
repo, in pure TypeScript, and everything else is built on it.

## 1. Core concepts

The engine supports 2 to 4 seats and non-rectangular boards from phase 0, and is shared
unchanged between the browser and the online room server (doc 09).

```ts
type PlayerId = 'p1' | 'p2' | 'p3' | 'p4';   // 2 to 4 seats from day one; see doc 09 section 3

interface Square { file: number; rank: number }          // 0-based

interface Board {
  width: number; height: number;                         // 8x8, 5x5, shrinking
  wrapFiles: boolean;                                    // wrap-around mode
  blocked: Record<string, BlockReason>;                  // lava, wall, removed ring
}

interface Piece {
  id: string;                    // stable for the whole game
  type: PieceTypeId;             // 'pawn', 'chancellor', 'camel', ...
  owner: PlayerId;
  home: Square;
  moved: boolean;
  marks: PieceMark[];            // shield, frozen, phoenix, bomb, hiddenQueen, decoy ...
}

interface GameState {
  board: Board;
  pieces: Record<string, Piece & { at: Square }>;
  turn: PlayerId;
  moveNumber: number;
  castling: CastlingRights; enPassant?: Square;
  halfmoveClock: number; positionCounts: Record<string, number>;
  reserves: Record<PlayerId, PieceTypeId[]>;             // drop-in mode
  players: Record<PlayerId, PlayerState>;                // modifiers, hand, mission, counters
  mode: ModeId; modeData: unknown;                       // per-mode counters (checks given, capture points ...)
  rng: RngState;                                         // seeded, advances deterministically
  result?: GameResult;
}
```

State is immutable and JSON-serialisable. A game is fully described by
`{ setup, seed, actions[] }`, which gives replay, undo, ghost replay and bug reports for free.

## 2. Piece types are data

```ts
interface PieceType {
  id: PieceTypeId;
  value: number;                         // for evaluation
  royal: boolean;
  moves: MovePattern[];                  // used for moving and capturing unless overridden
  captures?: MovePattern[];              // pawn, cannon
  promotes?: { rankFromFar: number; to: PieceTypeId[] };
}

type MovePattern =
  | { kind: 'leap';  offsets: [number, number][] }                       // knight, camel, king step
  | { kind: 'ride';  dirs: [number, number][]; max?: number;             // rook, bishop, tired queen
      passOwn?: boolean; hopsAllowed?: number }                          // ghost bishop, jumper rook
  | { kind: 'rideLeap'; offsets: [number, number][] }                    // nightrider
  | { kind: 'hopCapture'; dirs: [number, number][] }                     // cannon
  | { kind: 'hopLand'; dirs: [number, number][] }                        // grasshopper
  | { kind: 'pawn'; double: 'first' | 'always' | 'never' };            // direction comes from the seat's forward vector
```

Standard pieces, the Boss and every card piece are entries in one table. Adding a piece is
adding data plus tests.

## 3. Rule hooks

A game's rules are the base rules plus an ordered list of **rule modules**: one for the mode,
one per active modifier, one per active card effect. Each module may implement any of:

```ts
interface RuleModule {
  id: string;
  setup?(state): GameState;                                   // starting position changes
  pieceType?(state, piece): PieceType;                        // per-player piece changes (tired queen)
  extraActions?(state, player): Action[];                     // drops, buff activations, card plays
  filterActions?(state, player, actions): Action[];           // forced capture, mirror, truce, dice
  isRoyalCheckEnforced?(state, player): boolean;              // giveaway turns this off
  afterAction?(state, action, prev): GameState;               // explosions, shields expiring, lava timers
  turnOrder?(state): PlayerId;                                // progressive, monster, sleepy start
  checkEnd?(state): GameResult | undefined;                   // KOTH, three-check, capture race, missions
  visibility?(state, viewer): VisibilityMask;                 // fog, blind spot, costume party
  evalBonus?(state, player): number;                          // AI guidance for the mode
}
```

Action generation:

1. Generate pseudo-legal moves from piece patterns, respecting blocked squares and wrap.
2. Add castling, en passant, promotion, then `extraActions`.
3. Remove actions that leave the mover's royal piece attacked (if check is enforced).
4. Apply `filterActions` from every module in order.
5. If the list is empty, `checkEnd` decides between checkmate, stalemate or a mode result.

```ts
type Action =
  | { t: 'move'; pieceId; to; promoteTo? }
  | { t: 'castle'; side }
  | { t: 'drop'; type; to }
  | { t: 'buff'; buffId; args }
  | { t: 'card'; cardId; args }
  | { t: 'resign' };
```

Buff and card actions that "use your move" end the turn. Others return a state in which the
same player is still to move, with a flag recording that this turn's one activation is spent.

## 4. Match setup

`systems/setupMatch(profileA, profileB | bot, options, seed)` runs the pipeline from
`02-game-systems.md`: draw mode, compute gap, filter pools by tags, draw modifiers, deal
missions, accept hands, build the rule module list, call each `setup`. It returns the
initial `GameState` plus a `SetupReveal` object the UI animates.

## 5. Tactics module

Shared by alerts, missions, card earn conditions, badges, the miss map and post-game review.

| Function | Output |
|---|---|
| `attackMap(state, player)` | For each square, the pieces attacking it |
| `see(state, square)` | Static exchange evaluation: material outcome of a capture sequence on a square |
| `hanging(state, player)` | Pieces that lose material to a capture |
| `threats(state, player)` | What the opponent's last move newly attacks or threatens |
| `detectFork`, `detectPin`, `detectSkewer`, `detectDiscovered` | Tactic created by a move |
| `passedPawns`, `outposts`, `openFiles`, `doubledPawns` | Structural features |
| `availableTactics(state, player)` | Tactics the player could play now (drives ALERT-07 and the miss map) |

Each mission in the catalog maps to a detector with the exact definition given there.

## 6. AI

- Negamax with alpha-beta pruning, iterative deepening, quiescence search on captures,
  a transposition table, and move ordering (captures by value, then killer moves).
- Runs in a Web Worker. Uses only `legalActions(state)` and `apply(state, action)`, so it
  plays any mode and any modifier without special code.
- Evaluation: material from `PieceType.value`, piece-square tables for standard pieces on
  the standard board, mobility, king safety, plus each rule module's `evalBonus`, plus a
  bonus for progress toward the AI's own mission.
- Chance (dice mode, lava): the AI searches from the known current state only; it does not
  look through future random events.
- Hidden information: the AI is given a state filtered by `visibility` for its side. It never
  sees the human's mission, hidden queen or decoy.
- Cards and one-shot buffs are included in the action list only at the root and first reply,
  to keep the tree small.
- Strength control: search depth, a time cap, and a per-move chance of choosing a lower-ranked
  move. See `05-bots.md`.
- The same search provides hints: best move, top three moves, evaluation of a candidate
  move, and evaluation drop for post-game review.

Performance target: depth 4 with quiescence in under 1 second on a mid-range tablet for
standard chess. Measure before optimising; move to typed-array board representation only if needed.

## 7. Persistence

```ts
interface Profile {
  id; nickname; colour;
  rating; gamesPlayed; ratingHistory;
  collection: Record<CardId, number>;
  cardProgress: Record<CardId, number>;       // counters for multi-game earn conditions
  modeDeck: ModeId[]; lastMode?: ModeId; partyMatches: number;
  missMap: Record<TacticId, { missed: number; found: number }>;
  badges: Record<BadgeId, number>;
  missionsCompleted: number;
  botRecords: Record<BotId, { w: number; l: number; d: number }>;
  lastAlert?: AlertId;
}
```

Stored in localStorage under a versioned key with a migration function per version.
Finished games are stored as `{ setup, seed, actions }`, latest 50 per profile.

## 8. Testing

| Area | Method |
|---|---|
| Standard move generation | Perft from the starting position: depth 1 = 20, 2 = 400, 3 = 8,902, 4 = 197,281. Add the standard "Kiwipete" and endgame perft positions |
| Each mode | Fixture positions for the win condition and each special rule |
| Each modifier and card | A position before, the action, the expected position or legal-move set after |
| Each mission and tactic detector | FEN fixtures: at least 2 positive and 2 negative |
| Compatibility | Property test: for every mode and both opponent types, every drawable item passes its tag check, and a random 40-move game with random legal actions never throws |
| Determinism | Replaying `{ setup, seed, actions }` reproduces the final state hash |
| AI | Finds mate in 2 from fixtures; never returns an illegal action in any mode |

## 9. UI notes

- The board renders from `GameState` plus a `VisibilityMask` plus an overlay list
  (alert tints, counts, glows, marks). Overlays are produced by alert modules, not by the board.
- Fairy pieces need distinct, readable icons. Use simple original glyphs; do not copy an existing piece set.
- Hold-to-peek for the secret mission, so a neighbour cannot read it at a glance.
- Pass-and-play shows a "hand the device over" screen between private steps of match setup.
