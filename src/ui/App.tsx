import { useEffect, useState } from 'react';
import type { GameRecord } from '../core/record';
import { lookOf, activeProfile } from '../storage/storage';
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
import { BattleSetup } from './BattleSetup';
import { BattleScreen, type LocalBattle } from './BattleScreen';
import { useSave } from './store';
import { setShakeEnabled, setSoundEnabled } from './sound';

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
  | { name: 'battle' }
  | { name: 'battle-game'; local: LocalBattle; key: number }
  | { name: 'game'; config: GameConfig; key: number; review?: GameRecord };

export function App() {
  const save = useSave();
  const linkCode = roomFromUrl();
  const [screen, setScreen] = useState<Screen>(() => (!activeProfile(save) ? { name: 'profiles' } : linkCode ? { name: 'online', code: linkCode } : { name: 'home' }));
  const home = () => setScreen({ name: 'home' });
  const startGame = (config: GameConfig) => setScreen({ name: 'game', config, key: Date.now() });
  const openRecord = (rec: GameRecord) => setScreen({ name: 'game', key: Date.now(), review: rec, config: { kind: 'local', humanSeat: 'p1', names: rec.meta.players } });

  // While playing, the whole page becomes the board's landscape.
  const inGame = screen.name === 'game' || screen.name === 'online' || screen.name === 'battle-game' || screen.name === 'puzzles';
  useEffect(() => {
    document.body.style.background = inGame ? landscapeById(lookOf(save).landscape).scene : '';
    document.body.dataset.land = inGame ? lookOf(save).landscape : '';
  }, [inGame, lookOf(save).landscape]);

  // Sound and shake settings apply everywhere.
  useEffect(() => {
    setSoundEnabled(save.settings.sound);
    setShakeEnabled(save.settings.shake !== false);
    if (save.settings.shake === false) document.body.dataset.calm = '1';
    else delete document.body.dataset.calm;
  }, [save.settings.sound, save.settings.shake]);

  return (
    <main className="app">
      {screen.name === 'home' && (
        <Home
          go={(s) => setScreen((s === 'online' ? { name: 'online' } : { name: s }) as Screen)}
        />
      )}
      {screen.name === 'profiles' && <Profiles done={() => (linkCode ? setScreen({ name: 'online', code: linkCode }) : home())} />}
      {screen.name === 'online' && <OnlineLobby back={home} initialCode={screen.code} />}
      {screen.name === 'wardrobe' && <Wardrobe back={home} />}
      {screen.name === 'train' && <TrainSetup start={startGame} back={home} />}
      {screen.name === 'chesscom' && <ChessCom back={home} open={openRecord} />}
      {screen.name === 'leaderboard' && <Leaderboard back={home} />}
      {screen.name === 'puzzles' && <PuzzleScreen back={home} />}
      {screen.name === 'party' && <PartySetup start={startGame} back={home} />}
      {screen.name === 'battle' && <BattleSetup back={home} startDuel={startGame} startBattle={(local) => setScreen({ name: 'battle-game', local, key: Date.now() })} />}
      {screen.name === 'battle-game' && (
        <BattleScreen key={screen.key} local={screen.local} onExit={home} onAgain={() => setScreen({ name: 'battle-game', local: screen.local, key: Date.now() })} />
      )}
      {screen.name === 'bots' && <BotRoster start={startGame} back={home} />}
      {screen.name === 'history' && (
        <History
          back={home}
          open={openRecord}
        />
      )}
      {screen.name === 'game' && (
        <GameScreen key={screen.key} config={screen.config} reviewRecord={screen.review} onExit={home} onRematch={startGame} />
      )}
    </main>
  );
}
