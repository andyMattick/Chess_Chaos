import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { requestMove } from '../ai/client';
import { botById, type Bot } from '../content/bots';
import { addMyLine, buildMirror, learnFromGame, myLineFrom, nemesisBot, MIRROR_KEY, NEMESIS_PREFIX } from '../systems/nemesis';
import { STANDARD_FEN } from '../core/setup';
import { skinFor } from '../content/cosmetics';
import { pieceType } from '../core/pieces';
import { newRecord, replay, type GameRecord } from '../core/record';
import { diceOptions, diceRoll, type DiceChoice, flagSquare, hillData, MODE_INFO } from '../core/modes';
import { makeMove as makeMoveFast } from '../core/movegen';
import { PAINT_COLOUR, PAINT_NAME, paintTints } from './paintOverlay';
import { type ModeExtra, PAINT_ROUNDS, paintRound, paintScores, bossLives, cardChessOf, hiddenQueens, lavaNow, progressOf, reserveOf, ringSquares, shrinkIn } from '../core/modes2';
import { legalActions, play } from '../core/rules';
import { inCheck } from '../core/movegen';
import { toSAN } from '../core/san';
import { newSeed } from '../core/rng';
import type { Action, GameState, MoveAction, PlayerId } from '../core/types';
import { online, roomSkins, timeLeft } from '../net/client';
import { EMOTES } from '../net/protocol';
import { boardSkins, lookOf, activeProfile, addGame, noteOpponent, refreshOpponentRating, update, updateProfile, upsertProfile } from '../storage/storage';
import { updateRating } from '../systems/rating';
import { coinsFor, type CoinAward } from '../systems/coins';
import { Board } from './Board';
import { NumberPrompt } from './CloudSave';
import { Character } from './skins';
import { useSave } from './store';
import { requestAnalysis, requestReview } from '../ai/client';
import type { ReviewResult } from '../systems/review';
import { mergeMiss } from '../systems/review';
import { sameMove } from '../core/rules';
import { GoalList, useTraining, type TrainingConfig } from './training';
import { alertMode, chooseAlert } from '../systems/alerts';
import { EASY_GOALS, type EasyGoalId } from '../tactics/missions';
import { usePartyLayer } from './partyLayer';
import { defenceMoves, refereeMission, type PartySetup } from '../systems/party';
import { strengthFor } from '../ai/strength';
import { bonusById, missionById, modifierById } from '../content/party';
import { bonusDone } from '../systems/missions';
import type { MailGame } from '../net/world';
import { addFriend, getGame, resignMail, sendMailMove } from '../storage/world';
import { moveEvents, shakeFor, type MoveEvents } from './effects';
import { setSoundEnabled, sfx } from './sound';
import { useYourTurn } from './yourTurn';
import { QuickToggles } from './QuickToggles';
import { AnalysisPanel, noteOverlay } from './Analysis';
import { ArmyShop } from './ModesScreen';
import type { Analysis, MoveNote } from '../systems/analysis';
import { CardTile, useHand } from './Cards';
import { CARDS, POWER_CARDS, SUIT_ICON, cardById } from '../content/cards';
import { cardsEarned, settleStakes, takePrize, updateCollection } from '../systems/cards';

export interface GameConfig {
  /** 'local' is only used to replay saved games. */
  kind: 'local' | 'bot' | 'online' | 'mail';
  /** Start from this position (mini-game ladders). */
  fen?: string;
  /** A mini-game ladder step: winning it opens the next (content/minis.ts). */
  mini?: { id: string; level: number };
  /** Challenge game by player number, played a move at a time (src/net/world.ts). */
  mail?: { id: string; game: MailGame };
  /** A tournament game against a bot: this phone plays the bot's moves and sends them. */
  mailBot?: Bot;
  /** Game mode for new games (koth, hill-wars…). Default classic. */
  mode?: string;
  /** Mode setup choices (boss side, drafted armies, survival position). */
  extra?: ModeExtra;
  /** Solo challenges and practice: no rating change. */
  unrated?: boolean;
  /** Party match setup (modifiers and missions) for a new local game. */
  party?: PartySetup;
  /** Training game: one alert and open goals (docs/02 s2). */
  training?: TrainingConfig;
  botId?: string;
  /** In bot games, the seat the human plays. Online, the server decides. */
  humanSeat: PlayerId;
  names: Record<string, string>;
}

interface Props {
  config: GameConfig;
  onExit: () => void;
  onRematch: (c: GameConfig) => void;
  /** Open a saved game in review mode instead of playing. */
  reviewRecord?: GameRecord;
}

const REASON_TEXT: Record<string, string> = {
  checkmate: 'by checkmate!',
  resign: '(the other side gave up)',
  stalemate: 'Stalemate: no legal moves, but no check.',
  'draw-repetition': 'Draw: same position three times.',
  'draw-50': 'Draw: 50 moves with no capture or pawn move.',
  'draw-material': 'Draw: nobody can checkmate with what is left.',
  'draw-agreed': 'Draw agreed.',
  time: 'on time! (the other clock ran out)',
  mission: 'by finishing a SECRET MISSION! 🎯',
  'mode-win': 'by taking the hill! ⛰️',
};

/** How each mode is won, for the result line. */
const MODE_WIN_TEXT: Record<string, string> = {
  koth: 'by taking the hill! ⛰️', 'hill-wars': 'by holding the hill! 🚩', 'three-check': 'with the third check! ✔️',
  'capture-race': 'by winning the capture race! 🏁', 'capture-the-flag': 'by capturing the flag! 🏳️', atomic: 'by blowing up the king! 💥',
  giveaway: 'by giving everything away! 🎁', 'racing-kings': 'by racing to the top! 🏎️', horde: 'by wiping out the horde! 🐜',
  shrinking: 'when a king fell off the board! 📉', boss: 'by beating the Boss three times! 👹', survival: 'by holding out! 🛡️',
  paint: 'by painting the most squares! 🎨', 'pawn-wars': 'by promoting first! ♟️', 'racing-kings-chase': '',
};

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

const other = (p: PlayerId): PlayerId => (p === 'p1' ? 'p2' : 'p1');

export function GameScreen({ config, onExit, onRematch, reviewRecord }: Props) {
  const save = useSave();
  const net = useSyncExternalStore(online.subscribe, online.get, online.get);
  const isOnline = config.kind === 'online';
  // Online, everyone sees each army the way its owner dressed it.
  const skinsNow = boardSkins(save, isOnline ? roomSkins(net, lookOf(save).skins) : lookOf(save).skins);
  const nemesis = config.botId === `${NEMESIS_PREFIX}${MIRROR_KEY}` ? activeProfile(save)?.mirror : config.botId?.startsWith(NEMESIS_PREFIX) ? activeProfile(save)?.nemeses?.find((n) => `${NEMESIS_PREFIX}${n.key}` === config.botId) : undefined;
  // Memoised: the bot-move effect depends on it, so it must keep its identity between renders.
  const bot = useMemo(() => config.mailBot ?? (config.botId ? botById(config.botId) ?? (nemesis ? nemesisBot(nemesis) : undefined) : undefined), [config.botId, config.mailBot, nemesis?.builtAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const isMail = config.kind === 'mail' && !!config.mail;
  const me: PlayerId = isOnline ? net.seat ?? 'p1' : config.humanSeat;
  const botSeat: PlayerId | null = config.kind === 'bot' || (isMail && config.mailBot) ? other(config.humanSeat) : null;

  const [localRec, setLocalRec] = useState<GameRecord>(() => {
    if (reviewRecord) return reviewRecord;
    if (config.mail) return config.mail.game.record;
    const r = newRecord(newSeed(), config.names, config.fen, config.mode ?? 'standard');
    if (config.party) r.setup = { ...r.setup, party: config.party };
    if (config.extra) r.setup = { ...r.setup, extra: config.extra };
    return r;
  });
  const rec = isOnline && net.record ? net.record : localRec;
  const names: Record<string, string> = isOnline
    ? { p1: net.seats.p1?.name ?? '…', p2: net.seats.p2?.name ?? '…' }
    : config.names;
  const states = useMemo(() => replay(rec), [rec]);
  const live = states[states.length - 1];
  const [view, setView] = useState<number | null>(reviewRecord ? 0 : null);
  const shown = view === null ? live : states[Math.min(view, states.length - 1)];
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<MoveAction[] | null>(null);
  const [speech, setSpeech] = useState<{ seat: PlayerId; text: string } | null>(bot && botSeat ? { seat: botSeat, text: pick(bot.lines.greet) } : null);
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null);
  const [coinAward, setCoinAward] = useState<CoinAward | null>(null);
  const [newCards, setNewCards] = useState<string[]>([]);
  const [prize, setPrize] = useState<{ options: string[]; taken: string | null } | null>(null);
  // Bonus objective (docs/02 s5): done at the end, pick one of three Common cards.
  const [bonusPick, setBonusPick] = useState<{ id: string; done: boolean; options: string[]; taken: string | null } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | 'loading' | null>(null);
  const [note, setNote] = useState<MoveNote | null>(null);
  const hand = useHand();
  const finishedRef = useRef(!!reviewRecord);
  const reviewing = !!reviewRecord || view !== null;

  function push(a: Action) {
    if (isOnline) online.act(a);
    else if (isMail) sendMail(a);
    else setLocalRec((r) => ({ ...r, actions: [...r.actions, a] }));
  }

  // Challenge games: show the move at once, then the server's answer is the truth.
  const [mailNote, setMailNote] = useState<string | null>(null);
  // Sent one after another (against a bot, your move and its answer go close together).
  const mailQueue = useRef<Promise<unknown>>(Promise.resolve());
  function sendMail(a: Action) {
    const id = config.mail!.id;
    const ply = localRec.actions.length;
    setLocalRec((r) => ({ ...r, actions: [...r.actions, a] }));
    setMailNote(null);
    mailQueue.current = mailQueue.current.then(() => (a.t === 'resign' ? resignMail(id) : sendMailMove(id, a, ply))
      .then((g) => setLocalRec((r) => (g.record.actions.length >= r.actions.length || a.t === 'resign' ? g.record : r)))
      .catch((e) => {
        setMailNote(`${(e as Error).message} Your move was not sent.`);
        getGame(id).then((g) => setLocalRec(g.record)).catch(() => setLocalRec((r) => ({ ...r, actions: r.actions.slice(0, ply) })));
      }));
  }
  // Look for the other player's move now and then.
  useEffect(() => {
    if (!isMail || reviewRecord) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      getGame(config.mail!.id).then((g) => setLocalRec((r) => (g.record.actions.length > r.actions.length ? g.record : r))).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [isMail]); // eslint-disable-line react-hooks/exhaustive-deps

  const sanList = useMemo(() => {
    const out: string[] = [];
    rec.actions.forEach((a, i) => {
      if (a.t === 'move') out.push(toSAN(states[i], a));
    });
    return out;
  }, [rec, states]);

  const isHumanTurn = !live.result && !reviewRecord && live.turn === me;
  // "One fix" retry: replay the position before the mistake and try again.
  const [review, setReview] = useState<ReviewResult | null | 'loading'>(null);
  const [retry, setRetry] = useState<{ tries: number; solved: boolean; reveal: boolean } | null>(null);
  const fix = review && review !== 'loading' ? review.fix : null;
  const retrying = !!retry && !!fix && view === fix.ply;
  // Dice chess: pick give check / move the king / roll before moving (resets every turn).
  const [diceChoice, setDiceChoice] = useState<{ ply: number; choice: DiceChoice } | null>(null);
  const dicePick = diceChoice?.ply === live.ply ? diceChoice.choice : null;
  const diceOpts = useMemo(() => (live.mode === 'random-piece' && isHumanTurn && !reviewing && !live.result ? diceOptions(live, legalActions(live)) : null), [live, isHumanTurn, reviewing]);
  const legal = useMemo(() => {
    if (retrying && !retry!.solved && !retry!.reveal) return legalActions(states[fix!.ply]);
    if (!isHumanTurn || reviewing) return [];
    if (diceOpts) return diceOpts.escape.length ? diceOpts.escape : dicePick ? diceOpts[dicePick] : [];
    return legalActions(live);
  }, [live, isHumanTurn, reviewing, retrying, retry, fix, states, diceOpts, dicePick]);
  // Drop-in: a reserve piece picked from the tray. Hidden queen: choosing your secret pawn.
  const [dropPiece, setDropPiece] = useState<number | null>(null);
  const [pickingQueen, setPickingQueen] = useState(false);
  const targets = dropPiece !== null ? legal.filter((m) => m.piece === dropPiece) : selected === null ? [] : legal.filter((m) => m.piece === shown.sq[selected]);

  const lastMove = useMemo(() => {
    const idx = view === null ? rec.actions.length : view;
    const a = rec.actions[idx - 1];
    if (!a || a.t !== 'move') return null;
    return { from: states[idx - 1].pieces[a.piece].at, to: a.to };
  }, [rec, states, view]);

  // Chaos: effects and sounds for each new move (not while replaying).
  const [fx, setFx] = useState<MoveEvents | null>(null);
  const lastFxPly = useRef(states.length - 1);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSoundEnabled(save.settings.sound);
    const n = states.length - 1;
    if (reviewRecord || n <= lastFxPly.current) { lastFxPly.current = n; return; }
    lastFxPly.current = n;
    const ev = moveEvents(states[n - 1], live, rec.actions[n - 1], n);
    if (!ev) return;
    setFx(ev);
    // Restart the shake animation without remounting the board (pieces keep sliding).
    const el = wrapRef.current;
    const cls = shakeFor(ev);
    if (el && cls) {
      el.classList.remove('shake', 'shake-big');
      void el.offsetWidth;
      el.classList.add(cls);
    }
    if (ev.mate) sfx.mate();
    else if (ev.capture) sfx.capture(ev.capture.big);
    else if (ev.promo) sfx.promote();
    else if (ev.castle) sfx.castle();
    else sfx.move();
    if (ev.check) sfx.check();
    const t = setTimeout(() => setFx((f) => (f?.ply === ev.ply ? null : f)), ev.mate ? 3200 : 1500);
    return () => clearTimeout(t);
  }, [states.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loud "your turn" for games where you wait on someone else.
  useYourTurn(isHumanTurn && !reviewing && rec.actions.length > 0, { wrap: wrapRef, announce: isOnline || !!botSeat });

  // Training wheels online: my own alert, hints and goals, as in Train (only I see them).
  const seatsNow = isOnline ? net.seats : {};
  const myWheels = isOnline && !!seatsNow[me]?.wheels && net.seatIds.length === 2;
  const oppWheels = isOnline && !!seatsNow[other(me)]?.wheels && net.seatIds.length === 2;
  const wheelsCfg = useMemo<TrainingConfig | undefined>(() => {
    const p = activeProfile(save);
    if (!myWheels || !p) return undefined;
    const alert = chooseAlert(p.rating, p.missMap, p.lastAlert, Math.random);
    const goals = (Object.keys(EASY_GOALS) as EasyGoalId[]).sort(() => Math.random() - 0.5).slice(0, 3);
    return { alertId: alert.id, mode: alertMode(p.rating), goals };
  }, [myWheels, rec.id, rec.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const trainingCfg = config.training ?? wheelsCfg;
  // You agreed to their training wheels "just for fun": your rating stays the same this game.
  const forFun = isOnline && !!seatsNow[me]?.forFun && oppWheels;
  const ask = isOnline ? net.wheelsAsk ?? null : null;
  const extrasVote = isOnline ? net.extrasVote ?? null : null;
  // Both said "add as friend": keep their number (and their name, only on this phone).
  const newFriend = isOnline ? net.newFriend : null;
  useEffect(() => {
    if (newFriend) { try { addFriend(newFriend.number, newFriend.name); } catch { /* not a number */ } }
  }, [newFriend?.number]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tell both players how the vote went.
  const voteResult = extrasVote?.status;
  useEffect(() => {
    if (voteResult === 'on') setSpeech({ seat: me, text: '👍 Extras on!' });
    if (voteResult === 'off') setSpeech({ seat: me, text: '👎 No extras this game.' });
  }, [voteResult]); // eslint-disable-line react-hooks/exhaustive-deps
  const canAskWheels = isOnline && !reviewRecord && net.seatIds.length === 2 && rec.actions.length === 0 && !live.result && !myWheels && !ask && net.seatIds.every((k) => !!seatsNow[k]);

  const moveActions = useMemo(() => rec.actions.filter((a): a is MoveAction => a.t === 'move'), [rec]);
  const training = useTraining({
    cfg: trainingCfg, live, states, actions: moveActions, me,
    isMyTurn: isHumanTurn && !reviewing, selected, commit: (m) => commit(m),
  });

  const partySetup = rec.setup.party;
  const party = usePartyLayer({
    party: partySetup, live, me, myTurn: isHumanTurn && !reviewing, names, push, selected,
    takeBack: botSeat ? () => undo() : undefined,
  });

  // Party referee (bot games on this device; online the server referees).
  useEffect(() => {
    if (isOnline || !partySetup || live.result || reviewRecord) return;
    const done = refereeMission(states, rec.actions, partySetup);
    if (done) setLocalRec((r) => ({ ...r, actions: [...r.actions, done] }));
  }, [rec.actions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(m: MoveAction) {
    setSelected(null);
    setPromo(null);
    if (!retrying && !party.beforeCommit(m)) return;
    if (retrying && fix) {
      const good = fix.goodMoves.some((g) => sameMove(g, m));
      if (good) setRetry({ ...retry!, solved: true });
      else setRetry({ ...retry!, tries: retry!.tries + 1, reveal: retry!.tries + 1 >= 2 });
      return;
    }
    if (!training.beforeCommit(m)) return;
    push(m);
    training.afterCommit(m);
  }

  function onSquare(sq: number) {
    if (retrying) {
      if (retry!.solved || retry!.reveal) return;
    } else {
      if (reviewing || !isHumanTurn) return;
      if (party.interceptSquare(sq)) return;
      if (training.interceptSquare(sq) || training.locked) return;
      // Butterfingers: once you touch a piece, you must move it.
      if (party.lockSelection && selected !== null && !targets.some((m) => m.to === sq)) return;
    }
    const pos = retrying ? states[fix!.ply] : live;
    if (pickingQueen && !retrying) {
      const id = pos.sq[sq];
      if (id >= 0 && pos.pieces[id].owner === me && pos.pieces[id].type === 'pawn') { push({ t: 'buff', by: me, id: 'MODE-19', piece: id }); setPickingQueen(false); }
      return;
    }
    if (dropPiece !== null && !retrying) {
      const m = targets.find((x) => x.to === sq);
      setDropPiece(null);
      if (m) { commit(m); return; }
    }
    if (selected !== null) {
      const moves = targets.filter((m) => m.to === sq);
      if (moves.length > 1 && moves.some((m) => m.promo)) { setPromo(moves); return; }
      if (moves.length >= 1) { commit(moves[0]); return; }
    }
    const id = pos.sq[sq];
    if (id >= 0 && pos.pieces[id].owner === pos.turn && legal.some((m) => m.piece === id)) setSelected(sq);
    else setSelected(null);
  }

  // Bot turn (runs on this device).
  useEffect(() => {
    if (!botSeat || live.result || live.turn !== botSeat || reviewing) return;
    // Hidden queen: the bot secretly picks a pawn first (you never see which).
    if (live.mode === 'hidden-queen' && hiddenQueens(live)[botSeat] === undefined) {
      const pawns = live.pieces.filter((p) => p.at >= 0 && p.owner === botSeat && p.type === 'pawn');
      if (pawns.length) { setLocalRec((r) => ({ ...r, actions: [...r.actions, { t: 'buff', by: botSeat, id: 'MODE-19', piece: pawns[Math.floor(Math.random() * pawns.length)].id }] })); return; }
    }
    let cancelled = false;
    setThinking(true);
    // Your missions: the bot tries to undo a shown one, or block an open one (weaker bots sometimes miss).
    const undo = partySetup && Math.random() >= strengthFor(bot?.rating ?? 800).weakChance ? defenceMoves(states, rec.actions, partySetup, botSeat) : [];
    requestMove(live, bot?.rating ?? 800, (nemesis || bot?.id.startsWith(NEMESIS_PREFIX)) && bot ? { id: bot.id, asWhite: bot.asWhite, asBlack: bot.asBlack } : bot?.id, 450, undo.length ? undo : undefined).then((m) => {
      if (cancelled || !m) return;
      setThinking(false);
      if (live.sq[m.to] >= 0 && bot && Math.random() < 0.5) setSpeech({ seat: botSeat, text: pick(bot.lines.capture) });
      push(m);
    });
    return () => { cancelled = true; setThinking(false); };
  }, [live, botSeat, bot, reviewing]);

  // Online emotes show as speech bubbles for a few seconds.
  useEffect(() => {
    if (!isOnline || !net.lastEmote) return;
    const e = EMOTES.find((x) => x.id === net.lastEmote!.id);
    if (e) setSpeech({ seat: net.lastEmote.from, text: e.text });
    const t = setTimeout(() => setSpeech(null), 3500);
    return () => clearTimeout(t);
  }, [isOnline, net.lastEmote]);

  // A rematch online starts a fresh record.
  useEffect(() => {
    if (isOnline && !live.result && rec.actions.length === 0) {
      finishedRef.current = false;
      setRatingChange(null);
      setNewCards([]);
      setView(null);
    }
  }, [isOnline, live.result, rec.actions.length]);

  // Their new rating arrives after the game: update the leaderboard entry.
  const oppSeat = isOnline ? net.seats[other(me)] : undefined;
  useEffect(() => {
    if (!isOnline || !live.result || !oppSeat || oppSeat.botControlled) return;
    refreshOpponentRating(`online:${oppSeat.name.toLowerCase()}`, oppSeat.rating);
  }, [isOnline, !!live.result, oppSeat?.rating]); // eslint-disable-line react-hooks/exhaustive-deps

  // Game over: rating, records, saved game.
  useEffect(() => {
    if (!live.result || finishedRef.current) return;
    finishedRef.current = true;
    const finalRec: GameRecord = { ...rec, meta: { ...rec.meta, players: names, result: live.result, san: sanList } };
    const won = live.result.winners.includes(me);
    const drawn = live.result.winners.length === 0;
    if (bot && botSeat) setSpeech({ seat: botSeat, text: pick(won ? bot.lines.lose : !drawn ? bot.lines.win : bot.lines.greet) });
    const bonusId = rec.setup.party?.bonus?.[me];
    if (bonusId && !reviewRecord) {
      const done = bonusDone(bonusId, states, rec.actions, me);
      const commons = CARDS.filter((c) => c.rarity === 'Common' && !c.notYet).map((c) => c.id).sort(() => Math.random() - 0.5).slice(0, 3);
      setBonusPick({ id: bonusId, done, options: done ? commons : [], taken: null });
    }
    if (!activeProfile(save)) return;
    const oppRating = bot?.rating ?? (isOnline ? net.seats[other(me)]?.rating : isMail ? config.mail!.game.ratings[other(me) as 'p1' | 'p2'] : undefined);
    update((d) => {
      let p = activeProfile(d)!;
      // Mini-game ladders: a win opens the next step.
      if (config.mini && won) {
        const { id, level } = config.mini;
        const g = p.minis?.[id] ?? {};
        p = { ...p, minis: { ...(p.minis ?? {}), [id]: { ...g, level: Math.max(g.level ?? 0, level + 1) } } };
      }
      // A challenge game counts once, even if you open it again.
      if (isMail) {
        if ((p.mailDone ?? []).includes(config.mail!.id)) return d;
        p = { ...p, mailDone: [config.mail!.id, ...(p.mailDone ?? [])].slice(0, 200) };
      }
      if (oppRating !== undefined) {
        const firstWin = !!bot && won && (p.botRecords[bot.id]?.w ?? 0) === 0;
        const movesPlayed = rec.actions.filter((a, i) => a.t === 'move' && states[i].turn === me).length;
        const award = coinsFor({
          kind: config.training ? 'training' : isOnline || isMail ? 'online' : 'bot',
          result: won ? 'win' : drawn ? 'draw' : 'loss',
          opponent: oppRating, rating: p.rating, goalsDone: training.goalsDone.length, firstWin, movesPlayed,
        });
        setCoinAward(award);
        p = { ...p, coins: (p.coins ?? 0) + award.total };
      }
      if (oppRating !== undefined && rec.actions.length >= 2 && !forFun && !config.unrated) {
        const score = won ? 1 : drawn ? 0.5 : 0;
        const rating = updateRating(p.rating, oppRating, score, p.gamesPlayed, live.result!.reason === 'mission' ? 0.5 : 1);
        setRatingChange({ before: p.rating, after: rating });
        p = { ...p, rating, gamesPlayed: p.gamesPlayed + 1, ratingHistory: [...p.ratingHistory, { at: Date.now(), rating }].slice(-200) };
        if (bot) {
          const r0 = p.botRecords[bot.id] ?? { w: 0, l: 0, d: 0 };
          p = { ...p, botRecords: { ...p.botRecords, [bot.id]: { w: r0.w + (score === 1 ? 1 : 0), l: r0.l + (score === 0 ? 1 : 0), d: r0.d + (score === 0.5 ? 1 : 0) } } };
        }
      }
      if (oppRating !== undefined && rec.actions.length >= 2) {
        const score = won ? 1 : drawn ? 0.5 : 0;
        const oppName = names[other(me)];
        p = noteOpponent(p, bot
          ? { key: `bot:${bot.id}`, name: bot.name, kind: 'bot', rating: bot.rating, score }
          : isMail ? { key: `mail:${config.mail!.game.players[other(me) as 'p1' | 'p2']}`, name: oppName, kind: 'online', rating: oppRating, score }
          : { key: `online:${oppName.toLowerCase()}`, name: oppName, kind: 'online', rating: oppRating, score });
      }
      if (trainingCfg) {
        p = { ...p, lastAlert: trainingCfg.alertId, badges: { ...p.badges, 'goal-getter': (p.badges['goal-getter'] ?? 0) + training.goalsDone.length } };
      }
      // Power cards: burn the ones played, add the ones earned (docs/02 s6, s8).
      try {
        const earned = cardsEarned({ record: finalRec, states, me, rated: !trainingCfg, missionsCompleted: p.missionsCompleted, rating: p.rating, gamesPlayed: p.gamesPlayed }, p.cardProgress ?? {});
        // Party stakes: every card you brought is used up, win or lose. The winner takes one of the loser's.
        const brought = partySetup?.cards?.[me] ?? [];
        p = { ...p, collection: settleStakes(updateCollection(p.collection ?? {}, earned.cards, []), brought), cardProgress: earned.progress };
        setNewCards(earned.cards);
        const theirs = won ? partySetup?.cards?.[other(me)] ?? [] : [];
        setPrize(theirs.length ? { options: theirs, taken: null } : null);
      } catch (e) { console.warn('card check failed', e); }
      // Learning on the phone: nemeses learn from games against you; the Mirror learns your openings.
      try {
        const score = won ? 1 : drawn ? 0.5 : 0;
        const colour = me === 'p1' ? 'w' : 'b';
        const classic = rec.setup.kind === 'fen' && rec.setup.fen === STANDARD_FEN && rec.setup.mode === 'standard' && !partySetup;
        if (classic && nemesis && bot && rec.actions.length >= 2) {
          const learned = learnFromGame(nemesis, sanList, colour === 'w' ? 'b' : 'w', 1 - score);
          p = nemesis.mirror ? { ...p, mirror: learned } : { ...p, nemeses: p.nemeses.map((n) => (n.key === learned.key ? learned : n)) };
        }
        // Games against your own Mirror do not teach it your openings (it would copy itself).
        if (classic && !nemesis?.mirror) {
          const myLines = addMyLine(p.myLines, myLineFrom(sanList, colour, score));
          if (myLines !== p.myLines) p = { ...p, myLines, mirror: buildMirror(myLines, p.nickname, p.rating, p.mirror) };
        }
      } catch (e) { console.warn('nemesis learning failed', e); }
      if (isOnline) online.shareRating(p.rating);
      return addGame(upsertProfile(d, p), p.id, finalRec);
    });
    // Post-game review for games against bots (FB-01, FB-02, FB-07).
    if (bot && rec.actions.length >= 4) {
      setReview('loading');
      requestReview(finalRec, me).then((r) => {
        setReview(r);
        if (!r) return;
        update((d) => {
          const p = activeProfile(d);
          if (!p) return d;
          const badges = { ...p.badges };
          let tricks = 0;
          for (const [k, n] of Object.entries(r.badges)) {
            badges[k] = (badges[k] ?? 0) + n;
            if (k !== 'no-hang-streak') tricks += n;
          }
          const bonus = Math.min(tricks, 5) * 2;
          if (bonus) setCoinAward((c) => c && { total: c.total + bonus, lines: [...c.lines, { label: `Tricks found ×${Math.min(tricks, 5)}`, coins: bonus }] });
          return upsertProfile(d, { ...p, missMap: mergeMiss(p.missMap, r.miss), badges, coins: (p.coins ?? 0) + bonus });
        });
      });
    }
  }, [live.result]); // eslint-disable-line react-hooks/exhaustive-deps

  function undo() {
    if (!rec.actions.length || live.result || isOnline || isMail) return;
    let n = rec.actions.length - 1;
    if (botSeat) {
      while (n > 0 && states[n].turn !== config.humanSeat) n--;
      if (states[n].turn !== config.humanSeat) return;
    }
    setLocalRec((r) => ({ ...r, actions: r.actions.slice(0, n) }));
    setSelected(null);
  }

  function resign() {
    if (live.result) return;
    push({ t: 'resign', by: me });
  }

  const bottom: PlayerId = flipped ? other(me) : me;
  const top = other(bottom);

  const captured = (owner: PlayerId) =>
    shown.pieces.filter((p) => p.at < 0 && p.owner === owner).sort((a, b) => pieceType(b.type).value - pieceType(a.type).value);
  // Material lead in whole points (pawn 1, knight/bishop 3, rook 5, queen 9).
  const material = (owner: PlayerId) => shown.pieces.filter((p) => p.at >= 0 && p.owner === owner && p.type !== 'king').reduce((a, p) => a + Math.floor(pieceType(p.type).value), 0);
  const lead = (seat: PlayerId) => material(seat) - material(other(seat));

  let status: string;
  if (shown.result) {
    const w = shown.result.winners;
    const why = shown.result.reason === 'mode-win' ? MODE_WIN_TEXT[shown.mode] ?? 'by the mode rules!' : REASON_TEXT[shown.result.reason] ?? '';
    status = w.length ? `${w.map((x) => names[x]).join(' & ')} wins ${why}` : shown.result.reason === 'mode-win' ? 'Draw!' : REASON_TEXT[shown.result.reason] ?? 'Draw';
  } else if (thinking) status = `${names[shown.turn]} is thinking…`;
  else if (!reviewRecord && shown.turn === me) status = 'Your move!';
  else status = `${names[shown.turn]} to move`;

  const resultView = live.result && view === null && !reviewRecord;

  // Full analysis (any finished 1 vs 1 game, including replays and Chess.com imports).
  const canAnalyze = (!!live.result || !!reviewRecord) && live.seats.length === 2 && rec.actions.some((a) => a.t === 'move');
  const runAnalysis = () => {
    setAnalysis('loading');
    requestAnalysis(rec).then((a) => setAnalysis(a));
  };
  const pickNote = (n: MoveNote) => { setRetry(null); setNote(n); setView(n.ply); };
  // Endgame survival: a draw is a win for the side that had to hold.
  const won = live.result?.winners.includes(me) || (live.mode === 'survival' && !!live.result && !live.result.winners.length && live.modeData?.survivor === me);
  const opp = isOnline ? net.seats[other(me)] : undefined;
  const iVotedRematch = isOnline && net.rematchVotes.includes(me);
  const theyVotedRematch = isOnline && net.rematchVotes.includes(other(me));

  const avatar = (seat: PlayerId) => {
    if (bot && seat === botSeat) return <span className="avatar-emoji">{bot.emoji}</span>;
    return (
      <svg viewBox="0 0 100 100">
        <Character skin={skinFor(skinsNow, seat, 'king')} type="king" owner={seat} seed={seat === 'p1' ? 3 : 9} />
      </svg>
    );
  };

  return (
    <div className="game">
      <div className="game-main">
        <PlayerBar
          name={names[top]} rating={bot && top === botSeat ? bot.rating : net.seats[top]?.rating} avatar={avatar(top)}
          active={shown.turn === top && !shown.result} captured={captured(bottom)} speech={speech?.seat === top ? speech.text : null}
          colour={bot && top === botSeat ? bot.colour : undefined}
          lead={lead(top)} skins={skinsNow}
          clockMs={isOnline && !reviewing ? () => timeLeft(net, top) : null} clockRunning={net.clock?.running === top}
          note={isOnline && opp && top !== me ? (opp.botControlled ? '🤖 a bot took over' : !opp.connected ? '📡 reconnecting…' : null) : null}
        />
        <div className="banner-slot">
            {party.banner && !live.result && <div className="banner pink">{party.banner}</div>}
            {isMail && mailNote && <div className="banner pink">{mailNote}</div>}
            {isMail && !botSeat && !live.result && !reviewing && live.turn !== me && <div className="banner">📬 Their move. You can leave: it will be here when they play.</div>}
            {training.banner && !reviewing && !live.result && <div className={`banner ${training.banner.tone ?? ''}`}>{training.banner.text}</div>}
            {retrying && fix && (
              <div className={`banner ${retry!.solved ? '' : 'blue'}`}>
                {retry!.solved ? '🎉 Yes! That\'s much better.' : retry!.reveal ? `The better move was ${fix.bestSan}. See the glow!` : retry!.tries ? 'Not quite. One more try!' : '🔧 Find a better move than ' + fix.san}
              </div>
            )}
        </div>
        <div className="board-wrap" ref={wrapRef}>
          <Board
            state={shown}
            bottom={bottom}
            selected={reviewing && !retrying ? null : selected}
            targets={(reviewing && !retrying) || party.hideHints ? [] : targets}
            lastMove={party.hideHints && isHumanTurn ? null : lastMove}
            showCoordinates={save.settings.showCoordinates}
            landscape={lookOf(save).landscape}
            skins={skinsNow}
            interactive={(!reviewing && isHumanTurn) || retrying}
            onSquare={onSquare}
            fx={view === null ? fx : null}
            overlays={retrying && retry!.reveal && fix ? revealOverlay(states[fix.ply], fix.goodMoves[0]) : note && view === note.ply ? noteOverlay(note) : withFlags(shown, training.overlays ?? party.overlays, me)}
          />
          {training.modal}
          {isOnline && net.game === 'draft' && !rec.setup.extra?.armies && (
            net.armies?.[me] === 'ready'
              ? <div className="promo" role="dialog" aria-label="Waiting for armies"><p>🛒 Army ready! Waiting for {names[other(me)]} to finish shopping…</p></div>
              : <div className="promo shop-pop" role="dialog" aria-label="Build your army"><ArmyShop onDone={(army) => online.sendArmy(army)} /></div>
          )}
          {extrasVote?.status === 'pending' && !reviewRecord && (
            <div className="promo extras-vote" role="dialog" aria-label="Vote on the extras">
              <p>⚖️ <b>Extras for this game?</b> They're suggested from your ratings to make it fair.</p>
              {net.seatIds.map((k) => (
                <div key={k} className="extras-row">
                  <b>{k === me ? 'You' : names[k]}</b>
                  {(extrasVote.modifiers[k] ?? []).length ? (extrasVote.modifiers[k] ?? []).map((id) => {
                    const d = modifierById(id);
                    return d ? <div key={id} className={`mod ${d.kind}`}><span className="mod-emoji">{d.emoji}</span><span><b>{d.name}</b><small>{d.blurb}</small></span></div> : null;
                  }) : <span className="muted small">nothing</span>}
                </div>
              ))}
              {extrasVote.votes[me] === undefined ? (
                <div className="wheels-answers">
                  <button className="btn primary" onClick={() => online.voteExtras(true)}>👍 Use them</button>
                  <button className="btn" onClick={() => online.voteExtras(false)}>👎 Play without</button>
                </div>
              ) : <p className="muted small">You voted {extrasVote.votes[me] ? '👍' : '👎'}. Waiting for {names[other(me)]}…</p>}
              <p className="muted small">Both say yes: the extras are on. Anyone says no: you play without them.</p>
            </div>
          )}
          {ask?.status === 'pending' && ask.from !== me && (
            <div className="promo" role="dialog" aria-label="Training wheels request">
              <p>🚲 <b>{names[ask.from]}</b> asks for training wheels: danger alerts and hints that only they can see.</p>
              <div className="wheels-answers">
                <button className="btn primary" onClick={() => online.answerWheels('fun')}>Yes, just for fun<small>your rating stays the same</small></button>
                <button className="btn primary" onClick={() => online.answerWheels('rated')}>Yes, and it counts<small>for both ratings</small></button>
                <button className="btn" onClick={() => online.answerWheels('no')}>No thanks</button>
              </div>
            </div>
          )}
          {ask?.status === 'declined' && ask.from === me && (
            <div className="promo" role="dialog" aria-label="Training wheels answer">
              <p>{names[other(me)]} said no to training wheels this time. Still want to play?</p>
              <div className="wheels-answers">
                <button className="btn primary" onClick={() => online.wheelsOk()}>Play without them</button>
                <button className="btn" onClick={onExit}>Leave the room</button>
              </div>
            </div>
          )}
          {party.modal}
          {promo && (
            <div className="promo" role="dialog" aria-label="Choose a piece">
              <p>Your pawn made it! Turn it into…</p>
              <div className="promo-row">
                {promo.map((m) => (
                  <button key={m.promo} className="promo-btn" onClick={() => commit(m)} aria-label={m.promo}>
                    <svg viewBox="0 0 100 100"><Character skin={skinFor(skinsNow, me, m.promo!)} type={m.promo!} owner={me} badge /></svg>
                  </button>
                ))}
              </div>
              <button className="link" onClick={() => setPromo(null)}>never mind</button>
            </div>
          )}
          {resultView && (
            <div className="result-card" role="dialog" aria-label="Game over">
              <div className="result-emoji">{won ? '🏆' : live.result!.winners.length ? '💥' : '🤝'}</div>
              <h2>{won ? 'YOU WON!' : live.result!.winners.length ? 'Ooof. Good fight!' : 'A draw!'}</h2>
              <p>{status}</p>
              {partySetup && (
                <div className="mission-reveal">
                  {(Object.keys(partySetup.missions) as PlayerId[]).map((k) => {
                    const id = live.result?.reason === 'mission' && live.result.winners.includes(k) ? (live.modeData?.missionWin as string) : partySetup.missions[k];
                    const m = id && id !== '?' ? missionById(id) : undefined;
                    const won = live.result?.reason === 'mission' && live.result.winners.includes(k);
                    return <div key={k} className={won ? 'won' : ''}>🎯 {names[k]}: <b>{m ? m.name : 'secret'}</b>{won ? ' ✅ done!' : ''}{m && <small> {m.blurb}</small>}</div>;
                  })}
                </div>
              )}
              {review === 'loading' && <p className="muted thinking-dots">Looking over your game…</p>}
              {review && review !== 'loading' && (
                <div className="review">
                  {review.win && (
                    <div className="moment win">
                      <b>⭐ Your best moment: {review.win.san}</b>
                      <div>{review.win.text}</div>
                      <button className="btn small" onClick={() => { setRetry(null); setView(review.win!.ply + 1); }}>Show me</button>
                    </div>
                  )}
                  {review.fix && (
                    <div className="moment fix">
                      <b>🔧 One thing to fix: {review.fix.san}</b>
                      <div>{review.fix.text}</div>
                      {!party.noTakeBacks && <button className="btn small" onClick={() => { setRetry({ tries: 0, solved: false, reveal: false }); setView(review.fix!.ply); }}>Try it again</button>}
                    </div>
                  )}
                </div>
              )}
              {coinAward && coinAward.total > 0 && (
                <div className="coin-award" title={coinAward.lines.map((l) => `${l.label} +${l.coins}`).join('\n')}>
                  <span className="coin-big">🪙</span> +{coinAward.total}
                  <small>{coinAward.lines.map((l) => `${l.label} +${l.coins}`).join(' · ')}</small>
                </div>
              )}
              {!ratingChange && forFun && <p className="rating-change">🚲 Played for fun: your rating stays the same.</p>}
              {trainingCfg && !reviewRecord && (
                <div className="result-goals">
                  <b>🎯 Goals: {training.goalsDone.length} of {trainingCfg.goals.length}</b>
                  <GoalList goals={trainingCfg.goals} done={training.goalsDone} current={undefined} />
                </div>
              )}
              {prize && (
                <div className="new-cards prize" aria-label="Take a card">
                  {prize.taken ? <b>🏆 You took {cardById(prize.taken)?.emoji} {cardById(prize.taken)?.name}! (a full set of 3)</b> : <b>🏆 You won! Take one of {names[other(me)]}'s cards:</b>}
                  {!prize.taken && prize.options.map((id) => (
                    <CardTile key={id} c={cardById(id)!} small onClick={() => { updateProfile((x) => ({ ...x, collection: takePrize(x.collection ?? {}, id) })); setPrize({ ...prize, taken: id }); }} />
                  ))}
                </div>
              )}
              {bonusPick && (
                <div className="new-cards prize" aria-label="Bonus objective">
                  {!bonusPick.done ? <b>{bonusById(bonusPick.id)?.emoji} Bonus "{bonusById(bonusPick.id)?.name}": not this time. Next game!</b>
                    : bonusPick.taken ? <b>🎁 Bonus done! You took {cardById(bonusPick.taken)?.emoji} {cardById(bonusPick.taken)?.name}{POWER_CARDS ? ' (a full set of 3)' : ''}.</b>
                    : <b>🎁 Bonus "{bonusById(bonusPick.id)?.name}" done! Pick a card:</b>}
                  {bonusPick.done && !bonusPick.taken && bonusPick.options.map((id) => (
                    <CardTile key={id} c={cardById(id)!} small onClick={() => { updateProfile((x) => ({ ...x, collection: POWER_CARDS ? takePrize(x.collection ?? {}, id) : updateCollection(x.collection ?? {}, [id], []) })); setBonusPick({ ...bonusPick, taken: id }); }} />
                  ))}
                </div>
              )}
              {!won && (partySetup?.cards?.[me]?.length ?? 0) > 0 && <p className="rating-change">🃏 The cards you brought are used up. {live.result?.winners.length ? 'The winner may take one.' : ''}</p>}
              {newCards.length > 0 && (
                <div className="new-cards" aria-label="New power cards">
                  <b>🃏 New card{newCards.length > 1 ? 's' : ''}!{POWER_CARDS ? '' : ` For your collections: ${[...new Set(newCards.map((id) => cardById(id)!.suit))].map((s) => SUIT_ICON[s]).join(' ')}`}</b>
                  {newCards.map((id) => <CardTile key={id} c={cardById(id)!} small />)}
                </div>
              )}
              {ratingChange && (
                <p className="rating-change">
                  ★ {ratingChange.before} → <b>{ratingChange.after}</b> ({ratingChange.after >= ratingChange.before ? '+' : ''}{ratingChange.after - ratingChange.before})
                </p>
              )}
              <div className="row center">
                {isOnline ? (
                  <button className="btn primary" onClick={() => online.rematch(hand)} disabled={iVotedRematch}>
                    {iVotedRematch ? 'Waiting for them…' : theyVotedRematch ? 'They want a rematch! Go!' : 'Rematch'}
                  </button>
                ) : isMail ? (
                  <button className="btn primary" onClick={onExit}>📬 Back to challenges</button>
                ) : (
                  <button className="btn primary" onClick={() => onRematch({ ...config, humanSeat: other(config.humanSeat) })}>Play again</button>
                )}
                <button className="btn" onClick={() => setView(0)}>Replay it</button>
                {canAnalyze && <button className="btn" onClick={() => { runAnalysis(); setView(states.length - 1); }}>🔍 Full analysis</button>}
                <button className="btn" onClick={onExit}>Home</button>
              </div>
              {isOnline && net.seatIds.length === 2 && oppSeat && !oppSeat.botControlled && (() => {
                const myNo = activeProfile(save)?.cloud?.number;
                const theirs = other(me);
                const friendsNow = myNo && net.friendOffers?.includes(me) && net.friendOffers?.includes(theirs);
                if (!myNo) return <NumberPrompt why={`To add ${names[theirs]} as a friend, you need a player number.`} onYes={(n) => online.offerFriend(n)} />;
                if (friendsNow) return <p className="small">🤝 You and {names[theirs]} are friends now! Find them in 📬 Challenges.</p>;
                return (
                  <div className="row center friend-offer">
                    {net.friendOffers?.includes(me)
                      ? <span className="small">🤝 Asked {names[theirs]} to be friends. Waiting for them to tap it too…</span>
                      : <button className="btn small" onClick={() => online.offerFriend(myNo)}>🤝 {net.friendOffers?.includes(theirs) ? `${names[theirs]} wants to be friends! Say yes` : `Add ${names[theirs]} as a friend`}</button>}
                  </div>
                );
              })()}
            </div>
          )}
          {training.toast && <div className="toast">{training.toast}</div>}
          {party.toast && <div className="toast">{party.toast}</div>}
        </div>
        <PlayerBar
          name={names[bottom]} rating={bot && bottom === botSeat ? bot.rating : net.seats[bottom]?.rating} avatar={avatar(bottom)}
          active={shown.turn === bottom && !shown.result} captured={captured(top)} speech={speech?.seat === bottom ? speech.text : null}
          colour={bot && bottom === botSeat ? bot.colour : undefined}
          lead={lead(bottom)} skins={skinsNow}
          clockMs={isOnline && !reviewing ? () => timeLeft(net, bottom) : null} clockRunning={net.clock?.running === bottom}
        />
      </div>

      <aside className="game-side">
        {isOnline && <div className="room-code">Room <b>{net.code}</b></div>}
        {isOnline && (
          <div className="scoreboard" aria-label="Match score">
            <span>{names[me]}</span>
            <b>{fmtScore(net.score[me] ?? 0)}</b>
            <i>–</i>
            <b>{fmtScore(net.score[other(me)] ?? 0)}</b>
            <span>{names[other(me)]}</span>
            <small>{net.gamesPlayed ? `after ${net.gamesPlayed} game${net.gamesPlayed > 1 ? 's' : ''}` : 'first game'}</small>
          </div>
        )}
        {canAskWheels && (
          <button className="btn small wheels-ask" onClick={() => online.askWheels()}>🚲 Ask for training wheels</button>
        )}
        {ask?.status === 'pending' && ask.from === me && <div className="wheels-note">🚲 Asked {names[other(me)]} for training wheels. Waiting for an answer…</div>}
        {(myWheels || oppWheels) && !reviewRecord && (
          <div className="wheels-note">
            🚲 <b>{myWheels ? 'You have' : `${names[other(me)]} has`}</b> training wheels on: danger alerts and hints.
            {(myWheels ? seatsNow[other(me)]?.forFun : forFun)
              ? <small> Played for fun: {myWheels ? `${names[other(me)]}'s` : 'your'} rating won't change.</small>
              : <small> Counts for rating.</small>}
          </div>
        )}
        {!reviewRecord && training.panel}
        {!reviewRecord && party.panel}
        <ModeStatus s={shown} names={names} showBlurb={!partySetup} />
        {live.mode === 'progressive' && isHumanTurn && !reviewing && !live.result && progressOf(live).left < progressOf(live).quota && (
          <button className="btn small" onClick={() => push({ t: 'buff', by: me, id: 'STOP' })}>✋ That's enough, end my run</button>
        )}
        {diceOpts && (
          <div className="dice-panel">
            {diceOpts.escape.length ? <b>⚠️ You're in check! Block it or move out of it (any piece).</b> : !dicePick ? (
              <>
                <b>🎲 Your turn: what will you do?</b>
                <div className="dice-buttons">
                  <button className="btn small" disabled={!diceOpts.check.length} onClick={() => setDiceChoice({ ply: live.ply, choice: 'check' })}>⚔️ Give check{diceOpts.check.length ? '' : ' (none)'}</button>
                  <button className="btn small" disabled={!diceOpts.king.length} onClick={() => setDiceChoice({ ply: live.ply, choice: 'king' })}>👑 Move the king{diceOpts.king.length ? '' : ' (stuck)'}</button>
                  <button className="btn primary small" onClick={() => { sfx.dice(); setDiceChoice({ ply: live.ply, choice: 'roll' }); }}>🎲 Roll!</button>
                </div>
              </>
            ) : dicePick === 'roll' ? (
              <DiceResult r={diceRoll(live, legalActions({ ...live, mode: 'standard' }).filter((m) => !inCheck(makeMoveFast(live, m), live.turn)))} />
            ) : (
              <span>{dicePick === 'check' ? '⚔️ Pick a move that gives check.' : '👑 Move your king.'} <button className="btn small" onClick={() => setDiceChoice(null)}>Change</button></span>
            )}
          </div>
        )}
        {live.mode === 'hidden-queen' && !reviewRecord && !live.result && hiddenQueens(live)[me] === undefined && (
          <button className={`btn small ${pickingQueen ? 'primary' : ''}`} onClick={() => setPickingQueen((x) => !x)}>
            {pickingQueen ? 'Tap one of your pawns… (tap here to cancel)' : '👑 Pick your secret queen'}
          </button>
        )}
        {live.mode === 'card-chess' && <CardHands s={shown} me={me} names={names} myTurn={isHumanTurn && !reviewing} onDiscard={(i) => { const a: Action = { t: 'buff', by: me, id: 'DRAW', target: i }; try { play(live, a); push(a); } catch { /* not allowed now (in check) */ } }} skins={skinsNow} />}
        {live.mode === 'drop-in' && (
          <div className="reserve">
            {(['p1', 'p2'] as PlayerId[]).map((k) => {
              const res = reserveOf(shown, k);
              return (
                <div key={k} className="reserve-row">
                  <b>{names[k]}'s reserve:</b>
                  {res.length ? res.map((p) => (
                    <button key={p.id} className={`reserve-piece ${dropPiece === p.id ? 'on' : ''}`} disabled={k !== me || !isHumanTurn || reviewing || !legal.some((m) => m.piece === p.id)}
                      onClick={() => { setSelected(null); setDropPiece(dropPiece === p.id ? null : p.id); }} aria-label={`Drop a ${p.type}`}>
                      <svg viewBox="0 0 100 100"><Character skin={skinFor(skinsNow, k, p.type)} type={p.type} owner={k} /></svg>
                    </button>
                  )) : <span className="muted small"> empty</span>}
                </div>
              );
            })}
            {dropPiece !== null && <small>Tap an empty square to drop it in.</small>}
          </div>
        )}
        {live.mode === 'koth' && <div className="hill-goal">⛰️ King of the hill: get your king to a yellow square to win!</div>}
        {live.mode === 'hill-wars' && (() => {
          const h = hillData(shown);
          return (
            <div className="hill-goal">
              🚩 Hill wars: first to <b>{h.target}</b>
              {(['p1', 'p2'] as PlayerId[]).map((k) => (
                <div key={k} className="hill-bar"><div style={{ width: `${Math.min(100, ((h.scores[k] ?? 0) / h.target) * 100)}%` }} /><span>{names[k]}: {h.scores[k] ?? 0}</span></div>
              ))}
            </div>
          );
        })()}
        {retrying && <button className="btn small" onClick={() => { setRetry(null); setView(null); }}>← Back to results</button>}
        <div className={`status ${shown.result ? 'over' : ''}`} aria-live="polite">{status}</div>
        {reviewing ? (
          <div className="review-controls">
            <button className="btn small" onClick={() => setView(0)} aria-label="First move">⏮</button>
            <button className="btn small" onClick={() => setView((v) => Math.max(0, (v ?? states.length - 1) - 1))} aria-label="Previous move">◀</button>
            <span className="review-count">{view ?? states.length - 1}/{states.length - 1}</span>
            <button className="btn small" onClick={() => setView((v) => Math.min(states.length - 1, (v ?? 0) + 1))} aria-label="Next move">▶</button>
            <button className="btn small" onClick={() => setView(reviewRecord ? states.length - 1 : null)} aria-label="Last move">⏭</button>
          </div>
        ) : (
          <div className="row wrap">
            <button className="btn small" aria-pressed={!!save.settings.plainPieces} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, plainPieces: !d.settings.plainPieces } }))}>{save.settings.plainPieces ? '🎨 Show skins' : '♟ Plain pieces'}</button>
            {!isOnline && !isMail && !party.noTakeBacks && <button className="btn small" onClick={undo} disabled={!rec.actions.length || !!live.result || thinking}>↩ Take back</button>}
            <button className="btn small" onClick={() => setFlipped((f) => !f)}>⇅ Flip</button>
            <button className="btn small danger" onClick={resign} disabled={!!live.result}>🏳 Give up</button>
          </div>
        )}
        {isOnline && (
          <div className="emotes" aria-label="Send a reaction">
            {EMOTES.map((e) => (
              <button key={e.id} className="emote" onClick={() => online.emote(e.id)} title={e.text}>{e.text.split(' ')[0]}</button>
            ))}
          </div>
        )}
        {canAnalyze && !analysis && <button className="btn primary" onClick={runAnalysis}>🔍 Full analysis</button>}
        {analysis === 'loading' && <p className="thinking-dots">Checking every move…</p>}
        {analysis && analysis !== 'loading' && <AnalysisPanel a={analysis} names={names} me={me} note={note} onPick={pickNote} />}
        {(!analysis || analysis === 'loading') && <ol className="moves" aria-label="Moves">
          {Array.from({ length: Math.ceil(sanList.length / 2) }, (_, i) => (
            <li key={i}>
              <span className="num">{i + 1}.</span>
              <MoveCell san={sanList[i * 2]} idx={i * 2 + 1} view={view} onPick={(n) => setView(n)} />
              <MoveCell san={sanList[i * 2 + 1]} idx={i * 2 + 2} view={view} onPick={(n) => setView(n)} />
            </li>
          ))}
        </ol>}
        <QuickToggles />
        <button className="btn" onClick={onExit}>← Home</button>
      </aside>
    </div>
  );
}

function fmtScore(n: number) {
  return Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`;
}

function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (ms < 10_000) return (ms / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function revealOverlay(s: GameState, m?: MoveAction) {
  if (!m) return undefined;
  return { glow: new Set([s.pieces[m.piece].at, m.to]) };
}

function MoveCell({ san, idx, view, onPick }: { san?: string; idx: number; view: number | null; onPick: (n: number) => void }) {
  if (!san) return <span className="mv" />;
  return (
    <button className={`mv ${view === idx ? 'on' : ''}`} onClick={() => onPick(idx)}>
      {san}
    </button>
  );
}

function PlayerBar({ name, rating, avatar, active, captured, speech, colour, note, clockMs, clockRunning, lead, skins }: {
  name: string; rating?: number; avatar: ReactNode; active: boolean; captured: GameState['pieces'];
  speech: string | null; colour?: string; note?: string | null; clockMs?: (() => number | null) | null; clockRunning?: boolean; lead?: number; skins: import('../content/cosmetics').SkinChoice;
}) {
  // Re-render a few times a second while this clock is running; the time is worked out fresh each time.
  const [, tick] = useState(0);
  const hasClock = !!clockMs;
  useEffect(() => {
    if (!clockRunning || !hasClock) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [clockRunning, hasClock]);
  const ms = clockMs ? clockMs() : null;
  return (
    <div className={`player-bar ${active ? 'active' : ''}`}>
      <div className="avatar" style={{ background: colour ?? '#fff' }}>{avatar}</div>
      <div className="pname">
        {name}
        {rating !== undefined && <span className="prating">★{rating}</span>}
        {note && <span className="pnote">{note}</span>}
      </div>
      {speech && <div className="speech">{speech}</div>}
      {ms !== null && (
        <div className={`clock ${clockRunning ? 'running' : ''} ${ms < 20_000 ? 'low' : ''} ${ms < 10_000 ? 'panic' : ''}`} aria-label="Time left">
          {formatClock(ms)}
        </div>
      )}
      <div className="captured" aria-label="Captured pieces">
        {captured.map((p) => (
          <svg key={p.id} viewBox="0 0 100 100"><Character skin={skinFor(skins, p.owner, p.type)} type={p.type} owner={p.owner} seed={p.id + 1} /></svg>
        ))}
        {!!lead && lead > 0 && <span className="lead">+{lead}</span>}
      </div>
    </div>
  );
}

/** Capture the flag: tint both flag squares so everyone can see them. */
function withFlags(s: GameState, o: import('./Board').BoardOverlays | undefined, me?: PlayerId) {
  const tint = new Map(o?.tint ?? []);
  const badges = new Map(o?.badges ?? []);
  if (s.mode === 'capture-the-flag') for (const seat of s.seats) tint.set(flagSquare(s, seat.id), seat.id === 'p1' ? 'rgba(80, 160, 255, 0.55)' : 'rgba(255, 70, 70, 0.55)');
  if (s.mode === 'lava') for (const t of lavaNow(s)) tint.set(t, 'rgba(255, 110, 20, 0.75)');
  paintTints(s, tint);
  if (s.mode === 'shrinking') {
    const n = shrinkIn(s);
    if (n !== null && n <= 4) for (const t of ringSquares(s, ((s.modeData?.rings as number) ?? 0))) tint.set(t, 'rgba(255, 40, 40, 0.45)');
  }
  if (s.mode === 'hidden-queen' && me) {
    const q = hiddenQueens(s)[me];
    if (typeof q === 'number' && s.pieces[q]?.at >= 0) badges.set(s.pieces[q].at, '👑');
  }
  if (!tint.size && !badges.size) return o;
  return { ...(o ?? {}), tint, badges };
}

/** Live score box for the 2-player modes that need one (koth and hill wars have their own). */
function ModeStatus({ s, names, showBlurb }: { s: GameState; names: Record<string, string>; showBlurb: boolean }) {
  const info = MODE_INFO.find((m) => m.id === s.mode);
  if (!info || ['standard', 'koth', 'hill-wars', 'battle'].includes(info.id)) return null;
  const who = ['p1', 'p2'] as PlayerId[];
  let line: ReactNode = null;
  if (s.mode === 'three-check') {
    const c = (s.modeData?.checks as Record<string, number>) ?? {};
    line = who.map((k) => <div key={k}>{names[k]}: {'✔️'.repeat(c[k] ?? 0)}{'▫️'.repeat(Math.max(0, 3 - (c[k] ?? 0)))}</div>);
  } else if (s.mode === 'capture-race') {
    const pts = (s.modeData?.points as Record<string, number>) ?? {};
    line = who.map((k) => <div key={k} className="hill-bar"><div style={{ width: `${Math.min(100, ((pts[k] ?? 0) / 15) * 100)}%` }} /><span>{names[k]}: {pts[k] ?? 0} / 15</span></div>);
  } else if (s.mode === 'truce') {
    const left = Math.max(0, Math.ceil((20 - s.ply) / 2));
    line = <div>{left > 0 ? `🕊️ No captures for ${left} more move${left === 1 ? '' : 's'} each` : '💥 Truce is over. Capture away!'}</div>;
  } else if (s.mode === 'capture-the-flag') {
    line = <div>🔵 Blue square: White's flag. 🔴 Red square: Black's flag. Sit on the enemy flag for one turn to win.</div>;
  } else if (s.mode === 'shrinking') {
    const n = shrinkIn(s);
    line = <div>{n === null ? '📉 The board is as small as it gets.' : n <= 4 ? <b>⚠️ The outside ring falls in {Math.ceil(n / 2)} move{n > 2 ? 's' : ''}! Get off the red squares!</b> : `📉 Next ring falls in ${Math.ceil(n / 2)} moves.`}</div>;
  } else if (s.mode === 'progressive' && !s.result) {
    const p = progressOf(s);
    line = <div>📈 {names[s.turn]}: move <b>{p.quota - p.left + 1}</b> of {p.quota} <small>(runs grow to 5; you can stop early)</small></div>;
  } else if (s.mode === 'monster' && !s.result && s.turn === 'p1') {
    line = <div>👾 {names.p1}: move <b>{s.modeData?.monsterSecond ? 2 : 1}</b> of 2</div>;
  } else if (s.mode === 'boss') {
    const lives = bossLives(s);
    line = <div>👹 Boss lives: {'❤️'.repeat(lives)}{'🖤'.repeat(Math.max(0, 3 - lives))}</div>;
  } else if (s.mode === 'lava') {
    const n = lavaNow(s).length;
    line = <div>{n ? '🌋 Lava! Nothing can land on or slide through the orange squares.' : `🌋 Lava appears in ${10 - (s.ply % 10)} half-moves.`}</div>;
  } else if (s.mode === 'survival') {
    const left = Math.max(0, Math.ceil((40 - (s.ply - ((s.modeData?.surviveFrom as number) ?? 0))) / 2));
    line = <div>🛡️ Hold out for <b>{left}</b> more move{left === 1 ? '' : 's'}. A draw counts as a win!</div>;
  } else if (s.mode === 'paint') {
    const sc = paintScores(s);
    line = (
      <>
        <div>🎨 Round <b>{Math.min(PAINT_ROUNDS, paintRound(s) + 1)}</b> of {PAINT_ROUNDS}</div>
        {who.map((k) => <div key={k} className="hill-bar"><div style={{ width: `${Math.min(100, (sc[k] / 64) * 100)}%`, background: PAINT_COLOUR[k] }} /><span>{names[k]} ({PAINT_NAME[k]}): {sc[k]} squares</span></div>)}
      </>
    );
  } else if (s.mode === 'racing-kings') {
    line = <div>🏁 First king to the top row wins. No checks allowed, except to chase a king off the top row: it must survive one turn up there.</div>;
  }
  return (
    <div className="hill-goal">
      {showBlurb && <div>{info.emoji} <b>{info.name}</b>: {info.blurb}</div>}
      {line}
    </div>
  );
}

/** Card chess: your 3 cards (tap 🗑️ to throw one away instead of moving), and theirs. */
function CardHands({ s, me, names, myTurn, onDiscard, skins }: { s: GameState; me: PlayerId; names: Record<string, string>; myTurn: boolean; onDiscard: (i: number) => void; skins: import('../content/cosmetics').SkinChoice }) {
  const cc = cardChessOf(s);
  const them = me === 'p1' ? 'p2' : 'p1';
  const row = (p: PlayerId, mine: boolean) => (
    <div className={`cc-hand ${mine ? 'mine' : ''}`}>
      {(cc.hands[p] ?? []).map((k, i) => (
        <div key={i} className="cc-card" style={{ ['--t' as string]: `${(i - 1) * 6}deg` }}>
          <svg viewBox="0 0 100 100"><Character skin={skinFor(skins, p, k)} type={k} owner={p} /></svg>
          <span>{k}</span>
          {mine && myTurn && !s.result && !inCheck(s, me) && <button className="cc-discard" onClick={() => onDiscard(i)} title="Throw this card away (uses your turn)" aria-label={`Throw away the ${k} card`}>🗑️</button>}
        </div>
      ))}
      <small className="muted">deck {cc.decks[p]?.length ?? 0}</small>
    </div>
  );
  return (
    <div className="cc-panel">
      <b>🎴 Your cards</b>{cc.bonus && s.turn === me && <span className="cc-bonus"> Three of a kind: move again!</span>}
      {row(me, true)}
      <small>Move a piece that matches a card, or 🗑️ throw one away (that's your turn). In check, any move is fine.</small>
      <b className="muted small">{names[them]}'s cards</b>
      {row(them, false)}
    </div>
  );
}

const FACE: Record<string, string> = { pawn: '♟️', knight: '🐴', bishop: '⛪', rook: '🏰', queen: '👑', king: '🤴' };
/** The dice tumbling: up to 3 rolls, the last one that works is ticked. */
function DiceResult({ r }: { r: { rolls: string[]; kind: string } }) {
  return (
    <div className="dice-result">
      {r.rolls.map((f, i) => {
        const hit = i === r.rolls.length - 1 && r.kind !== 'any';
        return <span key={i} className={`die ${hit ? 'hit' : 'miss'}`} style={{ animationDelay: `${i * 0.35}s` }}>{FACE[f]}<small>{f}{hit ? ' ✓' : ' ✗'}</small></span>;
      })}
      <b>{r.kind === 'any' ? '3 misses: move any piece!' : `Move a ${r.kind}!`}</b>
    </div>
  );
}
