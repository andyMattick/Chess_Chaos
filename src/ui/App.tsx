import { useEffect, useState } from 'react';
import type { GameRecord } from '../core/record';
import { activeProfile } from '../storage/storage';
import { GameScreen, type GameConfig } from './GameScreen';
import { landscapeById } from './landscapes';
import { OnlineLobby, roomFromUrl } from './OnlineLobby';
import { BotRoster, History, Home, Profiles } from './screens';
import { Wardrobe } from './Wardrobe';
import { TrainSetup } from './TrainSetup';
import { useSave } from './store';

type Screen =
  | { name: 'home' }
  | { name: 'profiles' }
  | { name: 'bots' }
  | { name: 'history' }
  | { name: 'online'; code?: string | null }
  | { name: 'wardrobe' }
  | { name: 'train' }
  | { name: 'game'; config: GameConfig; key: number; review?: GameRecord };

export function App() {
  const save = useSave();
  const linkCode = roomFromUrl();
  const [screen, setScreen] = useState<Screen>(() => (!activeProfile(save) ? { name: 'profiles' } : linkCode ? { name: 'online', code: linkCode } : { name: 'home' }));
  const home = () => setScreen({ name: 'home' });
  const startGame = (config: GameConfig) => setScreen({ name: 'game', config, key: Date.now() });

  // While playing, the whole page becomes the board's landscape.
  const inGame = screen.name === 'game' || screen.name === 'online';
  useEffect(() => {
    document.body.style.background = inGame ? landscapeById(save.settings.landscape).scene : '';
    document.body.dataset.land = inGame ? save.settings.landscape : '';
  }, [inGame, save.settings.landscape]);

  return (
    <main className="app">
      {screen.name === 'home' && (
        <Home
          go={(s) => setScreen(s === 'online' ? { name: 'online' } : { name: s })}
        />
      )}
      {screen.name === 'profiles' && <Profiles done={() => (linkCode ? setScreen({ name: 'online', code: linkCode }) : home())} />}
      {screen.name === 'online' && <OnlineLobby back={home} initialCode={screen.code} />}
      {screen.name === 'wardrobe' && <Wardrobe back={home} />}
      {screen.name === 'train' && <TrainSetup start={startGame} back={home} />}
      {screen.name === 'bots' && <BotRoster start={startGame} back={home} />}
      {screen.name === 'history' && (
        <History
          back={home}
          open={(rec) => setScreen({ name: 'game', key: Date.now(), review: rec, config: { kind: 'local', humanSeat: 'p1', names: rec.meta.players } })}
        />
      )}
      {screen.name === 'game' && (
        <GameScreen key={screen.key} config={screen.config} reviewRecord={screen.review} onExit={home} onRematch={startGame} />
      )}
    </main>
  );
}
