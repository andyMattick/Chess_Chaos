import { useEffect, useRef } from 'react';
import { buzz, sfx } from './sound';

/**
 * Make "it's your turn" impossible to miss: a chime and a buzz when your turn
 * starts, the phone's browser bar and the tab title change colour, and if you
 * still haven't moved after a while, the board shakes and beeps (a few times).
 */
const IDLE_MS = 20_000;
const MAX_NUDGES = 3;

function setThemeColour(c: string) {
  let m = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!m) {
    m = document.createElement('meta');
    m.name = 'theme-color';
    document.head.appendChild(m);
  }
  m.content = c;
}

export function useYourTurn(myTurn: boolean, opts: { wrap: React.RefObject<HTMLElement | null>; announce: boolean }) {
  const baseTitle = useRef(document.title);
  useEffect(() => {
    const el = opts.wrap.current;
    if (!myTurn) {
      el?.classList.remove('my-turn');
      setThemeColour('#1f2a44');
      document.title = baseTitle.current;
      return;
    }
    el?.classList.add('my-turn');
    setThemeColour('#ffcb2b');
    document.title = '🟡 Your move! · World of C.H.A.O.S.';
    if (opts.announce) {
      sfx.yourTurn();
      buzz([60, 40, 60]);
    }
    let nudges = 0;
    const t = setInterval(() => {
      if (nudges >= MAX_NUDGES) return;
      nudges++;
      sfx.nudge();
      buzz(200);
      if (el) {
        el.classList.remove('nudge');
        void el.offsetWidth;
        el.classList.add('nudge');
      }
    }, IDLE_MS);
    return () => {
      clearInterval(t);
      el?.classList.remove('my-turn', 'nudge');
    };
  }, [myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    setThemeColour('#1f2a44');
    document.title = baseTitle.current;
  }, []);
}
