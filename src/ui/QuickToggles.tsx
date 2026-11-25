import { update } from '../storage/storage';
import { useSave } from './store';
import { Icon } from './icons';

/**
 * In-game switches for sound and board shake (the same settings as on the home screen).
 * Drawn icons with a short word under each, so they fit in one row with the
 * other game buttons on a phone (design review, 2026-11-25).
 */
export function QuickToggles({ bare = false }: { bare?: boolean }) {
  const s = useSave().settings;
  const set = (patch: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const shake = s.shake !== false;
  const buttons = (
    <>
      <button className={`ctl ${s.sound ? '' : 'off'}`} onClick={() => set({ sound: !s.sound })} aria-pressed={s.sound} aria-label={s.sound ? 'Sound on' : 'Sound off'} title="Sound effects">
        <Icon name={s.sound ? 'soundOn' : 'soundOff'} /><span>{s.sound ? 'Sound' : 'Quiet'}</span>
      </button>
      <button className={`ctl ${shake ? '' : 'off'}`} onClick={() => set({ shake: !shake })} aria-pressed={shake} aria-label={shake ? 'Shake on' : 'Shake off'} title="Board shake and phone buzz">
        <Icon name="shake" /><span>{shake ? 'Shake' : 'Still'}</span>
      </button>
    </>
  );
  return bare ? buttons : <div className="controls">{buttons}</div>;
}
