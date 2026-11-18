import { CARDS, HAND_SIZE, cardById, type CardDef } from '../content/cards';
import { activeProfile, updateProfile } from '../storage/storage';
import { COPIES_TO_PLAY, currentHand, handOptions } from '../systems/cards';
import { useSave } from './store';

/**
 * Power cards on screen: a single card tile, the collection screen
 * (everything you own and how to earn the rest), and the hand picker used
 * before a party match.
 */
export function CardTile({ c, count, on, onClick, children, small }: { c: CardDef; count?: number; on?: boolean; onClick?: () => void; children?: React.ReactNode; small?: boolean }) {
  const owned = count === undefined || count > 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`power-card ${c.rarity.toLowerCase()} ${owned ? '' : 'unowned'} ${on ? 'on' : ''} ${small ? 'small' : ''}`} onClick={onClick} aria-pressed={onClick ? !!on : undefined}>
      <span className="pc-emoji">{owned ? c.emoji : '❔'}</span>
      <span className="pc-name">{c.name}</span>
      {!small && <span className="pc-kind">{c.kind} · {c.rarity}{c.usesMove ? ' · uses your move' : ' · free action'}</span>}
      {!small && <span className="pc-blurb">{c.blurb}</span>}
      {!small && !owned && <span className="pc-earn">🔓 {c.earn}</span>}
      {count !== undefined && count > 0 && <span className={`pc-count ${count >= COPIES_TO_PLAY ? 'ready' : ''}`}>{count >= COPIES_TO_PLAY ? `×${count}` : `${count}/${COPIES_TO_PLAY}`}</span>}
      {children}
    </Tag>
  );
}

export function CardsScreen({ back }: { back: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  if (!p) return null;
  const owned = CARDS.filter((c) => (p.collection[c.id] ?? 0) > 0).length;
  return (
    <div className="panel wide taped">
      <h2>My power cards <span className="scribble">{owned} of {CARDS.length} found</span></h2>
      <p className="muted">Collect <b>3 of the same card</b> to bring it into a Party match (up to {HAND_SIZE} different ones). Playing it uses all 3. Earn more by playing!</p>
      <HandPicker />
      <div className="card-grid">
        {CARDS.map((c) => <CardTile key={c.id} c={c} count={p.collection[c.id] ?? 0} />)}
      </div>
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}

/** Pick the cards for the next party match. Saved on the profile. */
export function HandPicker() {
  const save = useSave();
  const p = activeProfile(save);
  if (!p) return null;
  const options = handOptions(p.collection);
  const hand = currentHand(p.collection, p.partyHand);
  const toggle = (id: string) => {
    const next = hand.includes(id) ? hand.filter((x) => x !== id) : hand.length < HAND_SIZE ? [...hand, id] : hand;
    updateProfile((x) => ({ ...x, partyHand: next }));
  };
  if (!options.length) {
    const closest = Object.entries(p.collection ?? {}).sort((a, b) => b[1] - a[1])[0];
    return (
      <p className="hand-empty">
        🃏 No card ready yet: you need 3 of the same card to bring it into a Party match.
        {closest ? ` Closest: ${cardById(closest[0])?.emoji} ${cardById(closest[0])?.name} (${closest[1]}/${COPIES_TO_PLAY}).` : ' Play games to earn cards.'}
      </p>
    );
  }
  return (
    <div className="hand-picker">
      <h3>🃏 Cards for your next Party match <small>({hand.length}/{HAND_SIZE})</small></h3>
      <div className="hand-row">
        {options.map((id) => <CardTile key={id} c={cardById(id)!} small on={hand.includes(id)} count={p.collection[id]} onClick={() => toggle(id)} />)}
      </div>
    </div>
  );
}

/** The hand to send with a party game. */
export function useHand(): string[] {
  const p = activeProfile(useSave());
  return p ? currentHand(p.collection, p.partyHand) : [];
}
