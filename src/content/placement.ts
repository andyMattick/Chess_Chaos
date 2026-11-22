/**
 * Deep puzzles for the placement test (systems/placement.ts): forced mates in 3
 * and in 4, found by scripts/gen-placement.ts in games between our own bots and
 * proved exactly by src/tactics/mateSolver.ts (no faster mate exists; the
 * defender's replies hold out longest). Checked again in tests/placement.test.ts.
 * Steps 1 and 2 of the test reuse the built-in puzzles (content/puzzles.ts).
 */
export interface DeepPuzzle { id: string; title: string; mateIn: 3 | 4; fen: string; san: string[] }

export const PLACEMENT_DEEP: DeepPuzzle[] = [
  { id: 'PLACE-M3-01', title: 'Mate in 3', mateIn: 3, fen: '8/4k1pR/2Q5/p1p1p1P1/8/N4P2/8/5K2 w - - 4 30', san: ["Qf6+","Kd7","Rxg7+","Ke8","Qe7#"] },
  { id: 'PLACE-M3-02', title: 'Three moves to checkmate', mateIn: 3, fen: '8/7r/3k4/3bqp2/8/p2K4/8/8 b - - 3 32', san: ["Qg3+","Kd2","Rh2+","Kd1","Qg1#"] },
  { id: 'PLACE-M3-03', title: 'Mate in 3: plan ahead', mateIn: 3, fen: '3R4/Q1p3k1/5p2/2p2r1p/2P1P1pP/6P1/3K4/8 w - - 0 42', san: ["Qxc7+","Kg6","Rg8+","Kh6","Qg7#"] },
  { id: 'PLACE-M3-04', title: 'Mate in 3', mateIn: 3, fen: '1Q6/5k2/8/1B5p/P2P3P/6K1/2p3P1/4R2R w - - 1 31', san: ["Qe8+","Kg7","Re7+","Kh6","Qc6#"] },
  { id: 'PLACE-M3-05', title: 'Three moves to checkmate', mateIn: 3, fen: 'r4kr1/2p1np2/1p3q2/p7/P2n1P1P/4K1P1/8/7b b - - 1 28', san: ["Rxg3+","Kf2","Qxf4+","Ke1","Rg1#"] },
  { id: 'PLACE-M3-06', title: 'Mate in 3: plan ahead', mateIn: 3, fen: '3Q3r/1rp2p1k/4bB2/p3P1pp/4p3/2P5/P1P3PP/4KB1R w K - 2 20', san: ["Qxh8+","Kg6","Qg8+","Kh6","Bxg5#"] },
  { id: 'PLACE-M3-07', title: 'Mate in 3', mateIn: 3, fen: '5B2/7R/2kP4/5B2/5B2/Q7/8/4K3 w - - 1 49', san: ["Qc3+","Kb6","Qb4+","Kc6","Be4#"] },
  { id: 'PLACE-M3-08', title: 'Three moves to checkmate', mateIn: 3, fen: '6k1/3PB3/1p6/1B5p/8/6P1/P1P3P1/1K1R3R w - - 1 29', san: ["d8=Q+","Kg7","Qf8+","Kh7","Bd3#"] },
  { id: 'PLACE-M3-09', title: 'Mate in 3: plan ahead', mateIn: 3, fen: '4k1r1/5p2/p1r5/3p1p1p/5P2/1Kb1qP2/1p6/8 b - - 1 31', san: ["Rb6+","Ka3","Qe7+","Ka4","Qb4#"] },
  { id: 'PLACE-M3-10', title: 'Mate in 3', mateIn: 3, fen: '2k3r1/3rQp1p/8/p1p2B2/R7/8/1PPBPP1P/4K2R w K a6 0 19', san: ["Qxd7+","Kb8","Bf4+","Ka8","Rxa5#"] },
  { id: 'PLACE-M3-11', title: 'Three moves to checkmate', mateIn: 3, fen: '4k3/1bp2pR1/5p1r/1Pp4p/1p2Pp1P/1P1Q4/r2PK3/6R1 w - - 14 36', san: ["Rg8+","Ke7","Qd8+","Ke6","Re8#"] },
  { id: 'PLACE-M3-12', title: 'Mate in 3: plan ahead', mateIn: 3, fen: '8/8/8/4k3/2q1b3/8/1K6/8 b - - 15 89', san: ["Qb4+","Ka2","Bf5","Ka1","Qb1#"] },
  { id: 'PLACE-M3-13', title: 'Mate in 3', mateIn: 3, fen: '1k6/8/2B5/p2N1nN1/P6p/7P/1P1P1RP1/R1BK4 w - - 1 22', san: ["Rxf5","Ka7","Rf8","Ka6","Ra8#"] },
  { id: 'PLACE-M3-14', title: 'Three moves to checkmate', mateIn: 3, fen: '3R4/1r3Q2/1p2p3/p1k5/P4P1p/8/1PP3PP/5K1R w - - 4 33', san: ["Qh5+","Kc6","Qb5+","Kc7","Qd7#"] },
  { id: 'PLACE-M4-01', title: 'Mate in 4', mateIn: 4, fen: '8/8/8/P1b5/8/3k4/5p2/2K5 b - - 3 88', san: ["f1=Q+","Kb2","Qf2+","Kb1","Qc2+","Ka1","Bd4#"] },
  { id: 'PLACE-M4-02', title: 'Four moves to checkmate', mateIn: 4, fen: '8/8/8/3bk3/2q5/8/8/1K6 b - - 13 88', san: ["Be4+","Kb2","Qb4+","Ka2","Bf5","Ka1","Qb1#"] },
  { id: 'PLACE-M4-03', title: 'Mate in 4: the long plan', mateIn: 4, fen: '6kr/1rp2p2/4bB2/p3P1pp/4p3/2P5/P1P3PP/3QKB1R w K - 0 19', san: ["Qd8+","Kh7","Qxh8+","Kg6","Qg8+","Kh6","Bxg5#"] },
  { id: 'PLACE-M4-04', title: 'Mate in 4', mateIn: 4, fen: '4kN2/p7/R7/2Q5/7p/4P3/2r3PP/4K2R w - - 0 24', san: ["Re6+","Kd8","Qd6+","Kc8","Re8+","Kb7","Rb8#"] },
  { id: 'PLACE-M4-05', title: 'Four moves to checkmate', mateIn: 4, fen: '4k1r1/5p2/p1r1q3/3p1p1p/5P2/2b1BP2/1pK5/8 b - - 1 30', san: ["Bd4+","Kb3","Rb6+","Ka3","Qd6+","Ka4","Qb4#"] },
  { id: 'PLACE-M4-06', title: 'Mate in 4: the long plan', mateIn: 4, fen: '1r4k1/6p1/p1p5/p3P2r/3pQ3/2bP4/5P2/1q1B1K1R b - - 1 33', san: ["Qxd1+","Qe1","Qxd3+","Qe2","Rxh1+","Kg2","Qh3#"] },
  { id: 'PLACE-M4-07', title: 'Mate in 4', mateIn: 4, fen: '3R1bk1/r2n4/6P1/1p6/b3bq2/2p4K/8/8 b - - 9 63', san: ["Qf3+","Kh4","Qf2+","Kg4","Bd1+","Kg5","Qf6#"] },
  { id: 'PLACE-M4-08', title: 'Four moves to checkmate', mateIn: 4, fen: '1r6/4k1p1/5p2/p2q1P2/P3B3/2p5/4K3/8 b - - 2 31', san: ["Qxe4+","Kf2","Rb2+","Kg3","Rg2+","Kh3","Qg4#"] },
  { id: 'PLACE-M4-09', title: 'Mate in 4: the long plan', mateIn: 4, fen: '2k5/8/2B5/p2N1nN1/P6p/7P/1P1P1bP1/R1BK1R2 w - - 0 21', san: ["Rxf2","Kb8","Rxf5","Ka7","Rf8","Ka6","Ra8#"] },
  { id: 'PLACE-M4-10', title: 'Mate in 4', mateIn: 4, fen: '6r1/kp4P1/p2Q3R/8/Pp6/3P4/5PP1/1R3K2 w - - 1 31', san: ["Qb6+","Ka8","Rxb4","Rb8","Qxa6+","bxa6","Rxa6#"] },
];
