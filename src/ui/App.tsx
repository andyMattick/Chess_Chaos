import { useEffect, useState } from 'react';
import type { GameRecord } from '../core/record';
import type { MailGame } from '../net/world';
import { LevelUpScreen } from './LevelUp';
import { askToKeepStorage, lookOf, activeProfile, updateProfile } from '../storage/storage';
import { startCloudSync, vaultBase } from '../storage/cloud';
import { NumberPrompt } from './CloudSave';
import { Popups } from './Popups';
import { DailyToast } from './DailyToast';
import { LadderAsk } from './LadderAsk';
import { GameScreen, type GameConfig } from './GameScreen';
import { landscapeById } from './landscapes';
import { OnlineLobby, roomFromUrl } from './OnlineLobby';
import { BotRoster, History, Home, Profiles } from './screens';
import { Wardrobe } from './Wardrobe';
import { TrainSetup } from './TrainSetup';
import { ChessCom } from './ChessCom';
import { Leaderboard } from './Leaderboard';
import { PartySetup } from './PartySetup';
import { PuzzleScreen } from './PuzzleScreen';
import { CardsScreen } from './Cards';
import { ModesScreen } from './ModesScreen';
import { BattleSetup } from './BattleSetup';
import { BattleScreen, type LocalBattle } from './BattleScreen';
import { useSave } from './store';
import { Challenges } from './Challenges';
import { MinisScreen } from './Minis';
import { OpeningTrainer } from './OpeningTrainer';
import { setShakeEnabled, setSoundEnabled } from './sound';
import { petWorld } from './petWorld';

type Screen =
  | { name: 'home' }
  | { name: 'profiles' }
  | { name: 'bots' }
  | { name: 'history' }
  | { name: 'online'; code?: string | null }
  | { name: 'wardrobe' }
  | { name: 'train' }
  | { name: 'chesscom' }
  | { name: 'leaderboard' }
  | { name: 'party' }
  | { name: 'puzzles' }
  | { name: 'cards' }
  | { name: 'modes' }
  | { name: 'challenges'; to?: string; game?: 'levelup' }
  | { name: 'minis' }
  | { name: 'openings'; botId?: string }
  | { name: 'battle' }
  | { name: 'levelup'; mail?: MailGame; key?: number; join?: string }
  | { name: 'battle-game'; local: LocalBattle; key: number }
  | { name: 'game'; config: GameConfig; key: number; review?: GameRecord };

export function App() {
  const save = useSave();
  // Inside Pet World's Game Room (src/ui/petWorld.ts): no room or Level-Up links, invites, player numbers or cloud saves.
  const linkCode = petWorld ? null : roomFromUrl();
  // A shared live Level-Up link: ?lu=LABC (owner, 2026-11-19).
  const luLink = petWorld ? null : (() => { try { const c = new URLSearchParams(location.search).get('lu')?.toUpperCase() ?? ''; return /^L[A-Z]{3}$/.test(c) ? c : null; } catch { return null; } })();
  const [screen, setScreen] = useState<Screen>(() => (!activeProfile(save) ? { name: 'profiles' } : luLink ? { name: 'levelup', join: luLink, key: Date.now() } : linkCode ? { name: 'online', code: linkCode } : { name: 'home' }));
  const home = () => setScreen({ name: 'home' });
  const startGame = (config: GameConfig) => setScreen({ name: 'game', config, key: Date.now() });
  const openRecord = (rec: GameRecord) => setScreen({ name: 'game', key: Date.now(), review: rec, config: { kind: 'local', humanSeat: 'p1', names: rec.meta.players } });

  // While playing, the whole page becomes the board's landscape.
  const inGame = screen.name === 'game' || screen.name === 'online' || screen.name === 'battle-game' || screen.name === 'puzzles';
  useEffect(() => {
    document.body.style.background = inGame ? landscapeById(lookOf(save).landscape).scene : '';
    document.body.dataset.land = inGame ? lookOf(save).landscape : '';
  }, [inGame, lookOf(save).landscape]);

  // Every new screen starts at the top (otherwise Home opened from far down a long page looks blank).
  const screenKey = screen.name + ('key' in screen ? String(screen.key) : '');
  useEffect(() => {
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior }); } catch { window.scrollTo(0, 0); }
  }, [screenKey]);

  // Ask the browser to keep our saved progress (best effort; it helps on Android and installed apps).
  useEffect(() => askToKeepStorage(), []);
  useEffect(() => { if (!petWorld) startCloudSync(); }, []);

  // No player number yet: ask once when the game opens (owner, 2026-11-18). "Not now" is remembered;
  // after that, only the things that need a number ask again.
  const askP = activeProfile(save);
  const [askOpen, setAskOpen] = useState(false);
  // Opened from a friend's invite link (?friend=12345678): remember the number, go to Challenges once there is a player.
  const [invite] = useState(() => {
    if (petWorld) return '';
    try {
      const n = new URLSearchParams(location.search).get('friend')?.replace(/\D/g, '') ?? '';
      if (n.length === 8) {
        sessionStorage.setItem('chess-chaos:invite', n);
        history.replaceState(null, '', location.pathname);
        return n;
      }
    } catch { /* no storage: ignore the invite */ }
    return '';
  });
  const [inviteShown, setInviteShown] = useState(false);
  useEffect(() => {
    if (invite && askP && !inviteShown && screen.name === 'home') { setInviteShown(true); setScreen({ name: 'challenges' }); return; }
    if (!petWorld && screen.name === 'home' && askP && !askP.cloud && !askP.numberDeclined && vaultBase() && !(invite && !inviteShown)) setAskOpen(true);
  }, [screen.name, askP?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sound and shake settings apply everywhere.
  useEffect(() => {
    setSoundEnabled(save.settings.sound);
    setShakeEnabled(save.settings.shake !== false);
    if (save.settings.shake === false) document.body.dataset.calm = '1';
    else delete document.body.dataset.calm;
  }, [save.settings.sound, save.settings.shake]);

  return (
    <main className="app">
      <DailyToast />
      {!petWorld && <LadderAsk quiet={inGame || askOpen || screen.name === 'profiles' || screen.name === 'levelup'} openLevelUp={() => setScreen({ name: 'levelup', key: Date.now() })} />}
      {!petWorld && <Popups openChallenges={() => setScreen({ name: 'challenges' })} openLive={(code) => setScreen({ name: 'levelup', join: code, key: Date.now() })} quiet={inGame || askOpen} inChallenges={screen.name === 'challenges'} />}
      {askOpen && askP && (
        <div className="number-modal" role="dialog" aria-label="Get a player number">
          <div>
            <NumberPrompt why={`Hi ${askP.nickname}! Want a player number? It's free.`} onNo={() => { updateProfile((x) => ({ ...x, numberDeclined: Date.now() })); setAskOpen(false); }} />
            {askP.cloud && <button className="btn primary" onClick={() => setAskOpen(false)}>Done</button>}
          </div>
        </div>
      )}
      {screen.name === 'home' && (
        <Home
          go={(s) => setScreen((s === 'online' ? { name: 'online' } : { name: s }) as Screen)}
        />
      )}
      {screen.name === 'profiles' && <Profiles done={() => (luLink ? setScreen({ name: 'levelup', join: luLink, key: Date.now() }) : linkCode ? setScreen({ name: 'online', code: linkCode }) : home())} />}
      {screen.name === 'online' && <OnlineLobby back={home} initialCode={screen.code} />}
      {screen.name === 'wardrobe' && <Wardrobe back={home} />}
      {screen.name === 'train' && <TrainSetup start={startGame} back={home} />}
      {screen.name === 'chesscom' && <ChessCom back={home} open={openRecord} play={startGame} />}
      {screen.name === 'leaderboard' && <Leaderboard back={home} challenge={(n) => setScreen({ name: 'challenges', to: n })} />}
      {screen.name === 'puzzles' && <PuzzleScreen back={home} startGame={startGame} />}
      {screen.name === 'cards' && <CardsScreen back={home} />}
      {screen.name === 'modes' && <ModesScreen start={startGame} back={home} />}
      {screen.name === 'party' && <PartySetup start={startGame} back={home} />}
      {screen.name === 'battle' && <BattleSetup back={home} startDuel={startGame} startBattle={(local) => setScreen({ name: 'battle-game', local, key: Date.now() })} />}
      {screen.name === 'battle-game' && (
        <BattleScreen key={screen.key} local={screen.local} onExit={home} onAgain={() => setScreen({ name: 'battle-game', local: screen.local, key: Date.now() })} />
      )}
      {screen.name === 'bots' && <BotRoster start={startGame} back={home} learn={(botId) => setScreen({ name: 'openings', botId })} />}
      {screen.name === 'openings' && <OpeningTrainer key={screen.botId ?? 'all'} back={home} botId={screen.botId} />}
      {screen.name === 'history' && (
        <History
          back={home}
          open={openRecord}
        />
      )}
      {screen.name === 'challenges' && <Challenges key={`${screen.to ?? ''}${screen.game ?? ''}`} initialTo={screen.to} initialGame={screen.game} back={home} play={startGame} playLevelUp={(g) => setScreen({ name: 'levelup', mail: g, key: Date.now() })} />}
      {screen.name === 'levelup' && <LevelUpScreen key={screen.key} back={screen.mail ? () => setScreen({ name: 'challenges' }) : home} mail={screen.mail} joinCode={screen.join} challengeFriend={() => setScreen({ name: 'challenges', game: 'levelup' })} />}
      {screen.name === 'minis' && <MinisScreen back={home} play={startGame} />}
      {screen.name === 'game' && (
        <GameScreen key={screen.key} config={screen.config} reviewRecord={screen.review} onExit={screen.config.kind === 'mail' ? () => setScreen({ name: 'challenges' }) : screen.config.mini || screen.config.mode === 'pawn-wars' ? () => setScreen({ name: 'minis' }) : home} onRematch={startGame} />
      )}
    </main>
  );
}
