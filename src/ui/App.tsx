import { useState } from 'react';
import type { GameRecord } from '../core/record';
import { activeProfile } from '../storage/storage';
import { GameScreen, type GameConfig } from './GameScreen';
import { BotRoster, History, Home, Profiles } from './screens';
import { useSave } from './store';

type Screen =
  | { name: 'home' }
  | { name: 'profiles' }
  | { name: 'bots' }
  | { name: 'history' }
  | { name: 'game'; config: GameConfig; key: number; review?: GameRecord };

export function App() {
  const save = useSave();
  const [screen, setScreen] = useState<Screen>(() => (activeProfile(save) ? { name: 'home' } : { name: 'profiles' }));
  const home = () => setScreen({ name: 'home' });
  const startGame = (config: GameConfig) => setScreen({ name: 'game', config, key: Date.now() });

  return (
    <main className="app">
      {screen.name === 'home' && (
        <Home
          go={(s) => {
            if (s === 'local') {
              const me = activeProfile(save)?.nickname ?? 'Player 1';
              startGame({ kind: 'local', humanSeat: 'p1', names: { p1: me === 'Player 1' ? 'White' : `${me} (White)`, p2: 'Black' } });
            } else setScreen({ name: s });
          }}
        />
      )}
      {screen.name === 'profiles' && <Profiles done={home} />}
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
