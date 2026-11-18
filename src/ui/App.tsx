import { useEffect, useState } from 'react';
import type { GameRecord } from '../core/record';
import { activeProfile } from '../storage/storage';
import { GameScreen, type GameConfig } from './GameScreen';
import { landscapeById } from './landscapes';
import { OnlineLobby } from './OnlineLobby';
import { BotRoster, History, Home, Profiles } from './screens';
import { Wardrobe } from './Wardrobe';
import { useSave } from './store';

type Screen =
  | { name: 'home' }
  | { name: 'profiles' }
  | { name: 'bots' }
  | { name: 'history' }
  | { name: 'online' }
  | { name: 'wardrobe' }
  | { name: 'game'; config: GameConfig; key: number; review?: GameRecord };

export function App() {
  const save = useSave();
  const [screen, setScreen] = useState<Screen>(() => (activeProfile(save) ? { name: 'home' } : { name: 'profiles' }));
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
          go={(s) => setScreen({ name: s })}
        />
      )}
      {screen.name === 'profiles' && <Profiles done={home} />}
      {screen.name === 'online' && <OnlineLobby back={home} />}
      {screen.name === 'wardrobe' && <Wardrobe back={home} />}
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
