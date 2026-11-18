import { update } from '../storage/storage';
import { useSave } from './store';

/** In-game switches for sound and board shake (the same settings as on the home screen). */
export function QuickToggles() {
  const s = useSave().settings;
  const set = (patch: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const shake = s.shake !== false;
  return (
    <div className="quick-toggles">
      <button className={`btn small ${s.sound ? '' : 'off'}`} onClick={() => set({ sound: !s.sound })} aria-pressed={s.sound} title="Sound effects">
        {s.sound ? '🔊 Sound on' : '🔇 Sound off'}
      </button>
      <button className={`btn small ${shake ? '' : 'off'}`} onClick={() => set({ shake: !shake })} aria-pressed={shake} title="Board shake and phone buzz">
        {shake ? '📳 Shake on' : '🧘 Shake off'}
      </button>
    </div>
  );
}
