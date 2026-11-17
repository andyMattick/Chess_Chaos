/**
 * Bot roster (docs/05-bots.md). A bot is an opening book plus the shared AI at
 * a set strength plus a personality. All names and characters are original.
 * Lines are SAN from the standard starting position; tests check every line is legal.
 */

export type BotId = `BOT-${string}`;

export interface BookLine { line: string; weight?: number }

export interface Bot {
  id: BotId;
  name: string;
  rating: number;
  opening: string;
  /** One-line tip for beating this bot, shown on the roster card. */
  tip: string;
  personality: string;
  colour: string;
  emoji: string;
  lines: { greet: string[]; capture: string[]; win: string[]; lose: string[] };
  asWhite: BookLine[];
  asBlack: BookLine[];
}

const L = (line: string, weight = 1): BookLine => ({ line, weight });

export const BOTS: Bot[] = [
  {
    id: 'BOT-01', name: 'Pip', rating: 400, opening: 'Italian Game', colour: '#f6c945', emoji: '🐣',
    tip: 'Pip often leaves pieces unguarded. Look for free captures!',
    personality: 'Brand new, cheerful, narrates its own moves.',
    lines: { greet: ['Hi! I just learned how the horsey moves!'], capture: ['Ooh, I got one!'], win: ['I won? Wow!'], lose: ['Good game! You are really good.'] },
    asWhite: [L('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O', 3), L('e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O'), L('e4 d5 exd5 Qxd5 Nc3 Qa5 Nf3 Nf6 d4'), L('e4 c5 Nf3 d6 Bc4 Nf6 d3')],
    asBlack: [L('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6'), L('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6'), L('d4 d5 Nf3 Nf6 c4 e6'), L('c4 e5 Nc3 Nf6')],
  },
  {
    id: 'BOT-02', name: 'Sam the Scholar', rating: 500, opening: 'Early queen attack', colour: '#c9a7f5', emoji: '🎓',
    tip: 'Sam aims the queen and bishop at f7. Guard it with a knight on f6 or the queen.',
    personality: 'Tries the four-move mate every game.',
    lines: { greet: ['I know a trick that wins in four moves!'], capture: ['Aha!'], win: ['The scholar strikes!'], lose: ['You saw my trick. Clever!'] },
    asWhite: [L('e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#', 2), L('e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#', 2), L('e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Ne2'), L('e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6 Ne2'), L('d4 d5 e4 dxe4 Qh5')],
    asBlack: [L('e4 e5 Nf3 Nc6 Bc4 Bc5'), L('d4 d5 c4 e6'), L('e4 e5 Bc4 Bc5')],
  },
  {
    id: 'BOT-03', name: 'Lola London', rating: 600, opening: 'London System', colour: '#7fb3e6', emoji: '🏰',
    tip: 'Lola builds the same house every game. Strike the centre early with ...c5.',
    personality: 'Builds the same house every time.',
    lines: { greet: ['Same house, same plan. Let us build!'], capture: ['Tidy!'], win: ['The house stands!'], lose: ['You knocked my house down!'] },
    asWhite: [L('d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3', 3), L('d4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3'), L('d4 e6 Bf4 d5 e3 Nf6 Nf3 Bd6 Bg3'), L('d4 e5 dxe5 Nc6 Nf3 Qe7 Bf4')],
    asBlack: [L('e4 d5 exd5 Qxd5 Nc3 Qa5'), L('d4 d5 c4 c6 Nf3 Nf6'), L('e4 e6 d4 d5'), L('Nf3 d5 g3 Nf6')],
  },
  {
    id: 'BOT-04', name: 'Captain Fork', rating: 700, opening: 'Four Knights', colour: '#e98a6b', emoji: '🏴‍☠️',
    tip: 'The Captain hunts for knight forks. Check which squares his knights can reach.',
    personality: 'Loves knights, shouts "fork!"',
    lines: { greet: ['Arr! Four knights on deck!'], capture: ['FORK! Er, I mean, gotcha!'], win: ['Victory for the knights!'], lose: ['You sank my ship!'] },
    asWhite: [L('e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6', 2), L('e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4 Bb4 Nxc6 bxc6 Bd3'), L('e4 c5 Nf3 Nc6 Nc3 Nf6 d4'), L('d4 d5 Nc3 Nf6 Nf3')],
    asBlack: [L('e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3'), L('e4 e5 Nf3 Nf6 d4 exd4 e5 Ne4 Qxd4 d5'), L('d4 Nf6 c4 e6 Nc3 Bb4'), L('e4 e5 Nc3 Nf6')],
  },
  {
    id: 'BOT-05', name: 'Fred', rating: 800, opening: 'Fried Liver Attack', colour: '#f2a541', emoji: '🍳',
    tip: 'Fred aims everything at f7. Keep your knight on f6 and do not grab pawns too fast.',
    personality: 'Aims everything at f7.',
    lines: { greet: ['Something is cooking on f7...'], capture: ['Sizzle!'], win: ['Fried!'], lose: ['Burnt my breakfast.'] },
    asWhite: [L('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3', 3), L('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5'), L('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 e5'), L('e4 c5 Nf3 Nc6 Bc4 e6')],
    asBlack: [L('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5'), L('e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7'), L('d4 d5 c4 e6')],
  },
  {
    id: 'BOT-06', name: 'Sven', rating: 800, opening: 'Scandinavian Defence', colour: '#8fd1c4', emoji: '⛵',
    tip: 'Sven brings his queen out early. Develop with tempo by attacking it.',
    personality: 'Queen out early, unbothered.',
    lines: { greet: ['My queen likes fresh air.'], capture: ['Ja!'], win: ['Smooth sailing.'], lose: ['A storm! Well played.'] },
    asWhite: [L('e4 e5 d4 exd4 Qxd4 Nc6 Qe3 Nf6 Nc3 Bb4 Bd2 O-O O-O-O', 2), L('e4 c5 d4 cxd4 Qxd4 Nc6 Qd1'), L('e4 d5 exd5 Qxd5 Nc3 Qa5 d4')],
    asBlack: [L('e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5', 3), L('e4 d5 exd5 Qxd5 Nf3 Bg4 Be2 Nc6'), L('e4 d5 e5 Bf5 d4 e6'), L('e4 d5 Nc3 d4 Nce2 e5'), L('d4 d5 c4 e6'), L('Nf3 d5 g3 Nf6')],
  },
  {
    id: 'BOT-07', name: 'Gus Gambit', rating: 900, opening: "King's Gambit", colour: '#e66b7f', emoji: '🎲',
    tip: 'Gus gives away pawns for fast attacks. Take the pawn, then get your pieces out quickly.',
    personality: 'Gives pawns away for fun.',
    lines: { greet: ['Want a free pawn? Go on!'], capture: ['Worth it!'], win: ['Fortune favours the bold!'], lose: ['The dice did not roll my way.'] },
    asWhite: [L('e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5', 2), L('e4 e5 f4 exf4 Nf3 d6 d4 g5 h4'), L('e4 e5 f4 d5 exd5 exf4 Nf3'), L('e4 e5 f4 Bc5 Nf3 d6 c3'), L('d4 d5 e4 dxe4 Nc3 Nf6 f3')],
    asBlack: [L('e4 e5 f4 exf4'), L('d4 d5 c4 dxc4 e3 e5'), L('e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2'), L('e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5')],
  },
  {
    id: 'BOT-08', name: 'Dana', rating: 900, opening: 'Danish Gambit', colour: '#f7a8c4', emoji: '🧁',
    tip: 'Dana offers two pawns. Give one back with ...d5 to finish developing.',
    personality: 'Two pawns down, all smiles.',
    lines: { greet: ['Pawns are for sharing!'], capture: ['Yum!'], win: ['Sweet!'], lose: ['Crumbs. Nice game.'] },
    asWhite: [L('e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2 d5 Bxd5 Nf6 Bxf7+ Kxf7 Qxd8', 2), L('e4 e5 d4 exd4 c3 d5 exd5 Qxd5 cxd4 Nc6 Nf3'), L('e4 c5 c3 d5 exd5 Qxd5 d4'), L('e4 e6 d4 d5 Nc3')],
    asBlack: [L('e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7'), L('e4 e5 Nf3 Nc6 Bc4 Nf6'), L('d4 d5 c4 e6')],
  },
  {
    id: 'BOT-09', name: 'Scotty', rating: 900, opening: 'Scotch Game', colour: '#6cc287', emoji: '🦄',
    tip: 'Scotty opens the centre early. Get castled before the files open up.',
    personality: 'Opens the centre early.',
    lines: { greet: ['Let us open the middle!'], capture: ['Brilliant!'], win: ['Och, a fine win.'], lose: ['Ye got me.'] },
    asWhite: [L('e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4', 2), L('e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4'), L('e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3'), L('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3')],
    asBlack: [L('e4 e5 Nf3 Nc6 Bb5 Nf6'), L('e4 e5 Nf3 Nc6 Bc4 Bc5'), L('d4 d5 c4 e6')],
  },
  {
    id: 'BOT-10', name: 'Vi', rating: 1000, opening: 'Vienna Game', colour: '#b48ae0', emoji: '🎻',
    tip: 'Vi pushes the f-pawn for a sneaky attack. Hit back in the centre with ...d5.',
    personality: 'Sneaky f-pawn.',
    lines: { greet: ['A little waltz in Vienna?'], capture: ['Encore!'], win: ['Bravo!'], lose: ['A lovely duet.'] },
    asWhite: [L('e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d4', 2), L('e4 e5 Nc3 Nc6 Bc4 Nf6 d3 Bb4 Ne2'), L('e4 e5 Nc3 Bc5 Nf3 d6 d4 exd4 Nxd4'), L('e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7')],
    asBlack: [L('e4 e5 Nf3 Nc6 Bc4 Nf6'), L('d4 Nf6 c4 e6'), L('e4 e5 Nc3 Nf6')],
  },
  {
    id: 'BOT-11', name: 'Queenie', rating: 1000, opening: "Queen's Gambit", colour: '#e0b04f', emoji: '👑',
    tip: 'Queenie is patient. Keep your pieces safe and watch the c-file.',
    personality: 'Patient, loves the c-file.',
    lines: { greet: ['Shall we have a proper game?'], capture: ['Splendid.'], win: ['How delightful.'], lose: ['Well played, dear.'] },
    asWhite: [L('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1', 3), L('d4 d5 c4 dxc4 e3 Nf6 Bxc4 e6 Nf3 c5 O-O'), L('d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4'), L('d4 Nf6 c4 e6 Nc3 Bb4 Qc2'), L('d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3')],
    asBlack: [L('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6'), L('e4 e5 Nf3 Nc6 Bb5 a6'), L('Nf3 d5 d4 Nf6 c4 e6'), L('c4 e5')],
  },
  {
    id: 'BOT-12', name: 'Madame Baguette', rating: 1000, opening: 'French Defence', colour: '#5e8de0', emoji: '🥖',
    tip: 'She builds pawn chains. Attack the base of the chain, not the head.',
    personality: 'Pawn chains and counterpunches.',
    lines: { greet: ['Bonjour! Shall we build a chain?'], capture: ['Voilà!'], win: ['Magnifique!'], lose: ['Ah, bien joué.'] },
    asWhite: [L('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3', 2), L('e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2'), L('e4 c5 c3 Nf6 e5 Nd5 d4'), L('e4 e5 Nf3 Nc6 d4 exd4 Nxd4')],
    asBlack: [L('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6', 2), L('e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7'), L('e4 e6 d4 d5 exd5 exd5 Bd3 Bd6'), L('e4 e6 d4 d5 Nd2 c5'), L('d4 e6 c4 d5'), L('d4 e6 e4 d5')],
  },
  {
    id: 'BOT-13', name: 'Caro', rating: 1100, opening: 'Caro-Kann Defence', colour: '#9ccf6b', emoji: '🐢',
    tip: 'Caro is careful and never rushes. Make a plan and be patient too.',
    personality: 'Careful, never rushes.',
    lines: { greet: ['Slow and steady.'], capture: ['Carefully done.'], win: ['Patience pays.'], lose: ['You were steadier than me.'] },
    asWhite: [L('e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4', 2), L('e4 e6 d4 d5 exd5 exd5 Bd3'), L('e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O')],
    asBlack: [L('e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7', 3), L('e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5'), L('e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6'), L('d4 d5 c4 c6 Nf3 Nf6'), L('Nf3 d5 d4 Nf6')],
  },
  {
    id: 'BOT-14', name: 'Ruy', rating: 1100, opening: 'Ruy Lopez', colour: '#c98b5a', emoji: '⚓',
    tip: 'Ruy squeezes slowly. Do not let your pieces get stuck behind your pawns.',
    personality: 'Old-school sailor, slow squeeze.',
    lines: { greet: ['Ahoy. A classic game, then.'], capture: ['Steady as she goes.'], win: ['Into port!'], lose: ['Fine seamanship.'] },
    asWhite: [L('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3', 3), L('e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8'), L('e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O'), L('e4 c5 Nf3 Nc6 Bb5 g6')],
    asBlack: [L('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'), L('e4 e5 Nf3 Nc6 Bc4 Bc5'), L('d4 d5 c4 e6')],
  },
  {
    id: 'BOT-15', name: 'Sal', rating: 1200, opening: 'Sicilian Defence', colour: '#ef7d57', emoji: '🌶️',
    tip: 'Sal fights from the side. Develop fast and watch the queenside.',
    personality: 'Fights for the centre from the side.',
    lines: { greet: ['Spicy game today?'], capture: ['Hot!'], win: ['Too spicy for you!'], lose: ['You handled the heat.'] },
    asWhite: [L('e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4', 2), L('e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3'), L('e4 e5 Nf3 Nc6 Bc4 Bc5'), L('e4 e6 d4 d5 e5')],
    asBlack: [L('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6', 3), L('e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6'), L('e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6'), L('e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7'), L('d4 Nf6 c4 c5 d5 e6'), L('Nf3 c5')],
  },
  {
    id: 'BOT-16', name: 'Dutch', rating: 1200, opening: 'Dutch Defence', colour: '#f39c33', emoji: '🌷',
    tip: 'Dutch pushes the f-pawn first, which weakens the king. Look at the e8-h5 diagonal.',
    personality: 'f-pawn first, always.',
    lines: { greet: ['F-pawn first, always!'], capture: ['Lekker!'], win: ['Tulips for me!'], lose: ['Goed gespeeld.'] },
    asWhite: [L('f4 d5 Nf3 Nf6 e3 g6 b3 Bg7 Bb2 O-O Be2', 2), L('f4 e5 fxe5 d6 exd6 Bxd6 Nf3 g5'), L('f4 c5 Nf3 Nc6 e3 g6'), L('f4 Nf6 Nf3 g6 e3 Bg7')],
    asBlack: [L('d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6', 3), L('d4 f5 c4 Nf6 Nc3 e6 Nf3 Bb4'), L('d4 f5 e4 fxe4 Nc3 Nf6 Bg5'), L('d4 f5 Bg5 g6'), L('c4 f5 Nc3 Nf6'), L('Nf3 f5 g3 Nf6 Bg2 e6'), L('e4 e6 d4 d5')],
  },
  {
    id: 'BOT-17', name: 'Indy', rating: 1300, opening: "King's Indian Defence", colour: '#d1495b', emoji: '🐅',
    tip: 'Indy lets you take the centre, then strikes back. Keep your king safe before you attack.',
    personality: 'Lets you take the centre, then strikes.',
    lines: { greet: ['Take the centre. I will wait.'], capture: ['Pounce!'], win: ['The tiger wins.'], lose: ['A worthy hunter.'] },
    asWhite: [L('Nf3 d5 g3 Nf6 Bg2 c6 O-O Bg4 d3 Nbd7 Nbd2 e5 e4', 2), L('Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O d3 d6'), L('e4 e6 d3 d5 Nd2 Nf6 Ngf3 c5 g3'), L('e4 c5 Nf3 e6 d3 Nc6 g3')],
    asBlack: [L('d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7', 3), L('d4 Nf6 Nf3 g6 g3 Bg7 Bg2 O-O O-O d6'), L('d4 Nf6 Bg5 Ne4'), L('e4 c5 Nf3 d6'), L('c4 Nf6 Nc3 g6'), L('Nf3 Nf6 g3 g6')],
  },
  {
    id: 'BOT-18', name: 'Professor English', rating: 1400, opening: 'English Opening', colour: '#4a6fa5', emoji: '🎩',
    tip: 'The Professor plays slowly and quietly. Every small weakness matters.',
    personality: 'Quiet, positional, final boss.',
    lines: { greet: ['Let us begin the lesson.'], capture: ['Quite.'], win: ['Class dismissed.'], lose: ['You have passed my class!'] },
    asWhite: [L('c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7', 3), L('c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O'), L('c4 Nf6 Nc3 e6 Nf3 d5 d4'), L('c4 e6 Nc3 d5 d4 Nf6'), L('c4 g6 Nc3 Bg7 g3')],
    asBlack: [L('c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7', 2), L('e4 c5 Nf3 Nc6'), L('d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6'), L('Nf3 c5 c4 Nc6')],
  },
];

export function botById(id: string): Bot | undefined {
  return BOTS.find((b) => b.id === id);
}
