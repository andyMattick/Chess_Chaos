import { useState } from 'react';
import { CARDS, HAND_SIZE, POWER_CARDS, SUITS, SUIT_ICON, SUIT_NAME, cardById, type CardDef, type Suit } from '../content/cards';
import { COLLECTIONS, SELL_PRICE, SET_SKIN_PRICE, type CollectionSet, type SetRarity } from '../content/collections';
import { redeemSet, sellCard, setProgress, wearSet } from '../systems/collections';
import { Character, skinInfo } from './skins';
import { sfx } from './sound';
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
      {!POWER_CARDS && <span className="pc-suit" title={`${SUIT_NAME[c.suit]} card`}>{SUIT_ICON[c.suit]}</span>}
      <span className="pc-emoji">{owned ? c.emoji : '❔'}</span>
      <span className="pc-name">{c.name}</span>
      {!small && POWER_CARDS && <span className="pc-kind">{SUIT_ICON[c.suit]} {c.kind} · {c.rarity}{c.usesMove ? ' · uses your move' : ' · free action'}</span>}
      {!small && !POWER_CARDS && <span className="pc-kind">{SUIT_NAME[c.suit]} card · {c.rarity}</span>}
      {!small && POWER_CARDS && <span className="pc-blurb">{c.blurb}</span>}
      {!small && !owned && <span className="pc-earn">🔓 {c.earn}</span>}
      {count !== undefined && count > 0 && (POWER_CARDS
        ? <span className={`pc-count ${count >= COPIES_TO_PLAY ? 'ready' : ''}`}>{count >= COPIES_TO_PLAY ? `×${count}` : `${count}/${COPIES_TO_PLAY}`}</span>
        : <span className="pc-count ready">×{count}</span>)}
      {children}
    </Tag>
  );
}

export function CardsScreen({ back }: { back: () => void }) {
  const save = useSave();
  const p = activeProfile(save);
  const [tab, setTab] = useState<'cards' | 'sets'>('cards');
  const [selling, setSelling] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (!p) return null;
  const owned = CARDS.filter((c) => (p.collection[c.id] ?? 0) > 0).length;
  const sell = (id: string) => {
    const r = sellCard(p.collection, id);
    if (!r) return;
    updateProfile((x) => ({ ...x, collection: r.cards, coins: (x.coins ?? 0) + r.coins }));
    setNote(`Sold ${cardById(id)?.name} for 🪙 ${r.coins}.`);
    setSelling(null);
  };
  return (
    <div className="panel wide taped">
      <h2>{POWER_CARDS ? 'My power cards' : 'My cards'} <span className="scribble">{owned} of {CARDS.length} found</span></h2>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'cards'} className={`tab ${tab === 'cards' ? 'on' : ''}`} onClick={() => setTab('cards')}>🃏 My cards</button>
        <button role="tab" aria-selected={tab === 'sets'} className={`tab ${tab === 'sets' ? 'on' : ''}`} onClick={() => setTab('sets')}>🏆 Collections</button>
      </div>
      {note && <p className="banner">{note}</p>}
      {tab === 'cards' ? (
        <>
          {POWER_CARDS
            ? <p className="muted">Collect <b>3 of the same card</b> to bring it into a Party match (up to {HAND_SIZE} different ones). Playing it uses all 3. Every card also belongs to a piece ({SUIT_ICON.pawn} {SUIT_ICON.rook} {SUIT_ICON.knight} {SUIT_ICON.bishop} {SUIT_ICON.queen} {SUIT_ICON.king}): turn in sets of pieces in <b>Collections</b> to win skins. Spare cards can be sold for coins. 🪙 {p.coins}</p>
            : <p className="muted">You earn cards by playing. Every card belongs to a piece. Turn in one card of each piece in a set (🏆 Collections) to win a skin. Spare cards can be sold for coins. 🪙 {p.coins}</p>}
          <SuitCounts collection={p.collection} />
          <HandPicker />
          {!POWER_CARDS ? SUITS.map((suit) => {
            const cards = CARDS.filter((c) => c.suit === suit && !c.notYet);
            const n = cards.reduce((a, c) => a + (p.collection[c.id] ?? 0), 0);
            return (
              <details key={suit} className="suit-group" open={n > 0}>
                <summary><span className="suit-icon">{SUIT_ICON[suit]}</span> <b>{SUIT_NAME[suit]} cards: {n}</b></summary>
                <div className="card-grid">
                  {cards.map((c) => {
                    const k = p.collection[c.id] ?? 0;
                    return (
                      <CardTile key={c.id} c={c} count={k}>
                        {k > 0 && (selling === c.id ? (
                          <span className="row"><button className="btn small danger" onClick={() => sell(c.id)}>Sell 1 for 🪙 {SELL_PRICE[c.rarity]}</button><button className="btn small" onClick={() => setSelling(null)}>Keep</button></span>
                        ) : <button className="btn small" onClick={() => setSelling(c.id)}>Sell</button>)}
                      </CardTile>
                    );
                  })}
                </div>
              </details>
            );
          }) : (
          <div className="card-grid">
            {CARDS.map((c) => {
              const n = p.collection[c.id] ?? 0;
              return (
                <CardTile key={c.id} c={c} count={n}>
                  {n > 0 && (selling === c.id ? (
                    <span className="row"><button className="btn small danger" onClick={() => sell(c.id)}>Sell 1 for 🪙 {SELL_PRICE[c.rarity]}</button><button className="btn small" onClick={() => setSelling(null)}>Keep</button></span>
                  ) : <button className="btn small" onClick={() => setSelling(c.id)}>Sell</button>)}
                </CardTile>
              );
            })}
          </div>
          )}
        </>
      ) : <Collections onNote={setNote} />}
      <button className="btn" onClick={back}>← Home</button>
    </div>
  );
}

/** How many cards you have of each piece: what a set needs. */
function suitCount(collection: Record<string, number>, suit: Suit): number {
  return CARDS.filter((c) => c.suit === suit).reduce((a, c) => a + (collection[c.id] ?? 0), 0);
}

export function SuitCounts({ collection }: { collection: Record<string, number> }) {
  return (
    <div className="suit-counts" aria-label="Your cards by piece">
      {SUITS.map((s) => {
        const n = suitCount(collection, s);
        return <span key={s} className={`suit-count ${n ? 'has' : 'none'}`} title={`${SUIT_NAME[s]} cards`}><span className="suit-icon">{SUIT_ICON[s]}</span><b>{n}</b><small>{SUIT_NAME[s]}</small></span>;
      })}
    </div>
  );
}

const RARITY_TEXT: Record<SetRarity, string> = { Common: '2 pieces', Uncommon: '3 pieces', Rare: '4 pieces', Epic: '5 pieces', Legendary: 'all 6 pieces' };

/** Collections: turn in one card of each piece to unlock a skin. */
function Collections({ onNote }: { onNote: (t: string) => void }) {
  const save = useSave();
  const p = activeProfile(save)!;
  const [show, setShow] = useState<SetRarity>('Common');
  const owns = (c: CollectionSet) => p.owned.skins.includes(c.skin);
  const turnIn = (c: CollectionSet) => {
    const r = redeemSet(p.collection, c);
    if (!r) return;
    updateProfile((x) => ({ ...x, collection: r.cards, owned: { ...x.owned, skins: [...new Set([...x.owned.skins, c.skin])] }, look: { ...x.look, skins: wearSet(x.look.skins, c) } }));
    sfx.promote();
    onNote(`🎉 ${c.name} turned in! Your ${c.pieces.map((s) => SUIT_NAME[s].toLowerCase()).join(', ')} pieces now wear ${skinInfo(c.skin).name}. Change it any time in the Wardrobe.`);
  };
  const buy = (c: CollectionSet, price: number) => {
    if (p.coins < price) return;
    updateProfile((x) => ({ ...x, coins: x.coins - price, owned: { ...x.owned, skins: [...new Set([...x.owned.skins, c.skin])] } }));
    sfx.promote();
    onNote(`${skinInfo(c.skin).name} unlocked!`);
  };
  const rarities: SetRarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  const done = (r: SetRarity) => COLLECTIONS.filter((c) => c.rarity === r && owns(c)).length;
  const isReady = (c: CollectionSet) => !owns(c) && !setProgress(p.collection, c).missing.length;
  const readyCount = (r: SetRarity) => COLLECTIONS.filter((c) => c.rarity === r && isReady(c)).length;
  return (
    <>
      <p className="muted">Turn in one card of each piece in a set to unlock its skin for good. The cards are used up, so you'd have to collect them again to turn the set in again.</p>
      <p className="small"><b>Your cards by piece</b> (a set needs one card of each of its pieces; ✨ ready sets share cards, so turning one in can use cards another needs):</p>
      <SuitCounts collection={p.collection} />
      <div className="clock-chips">
        {rarities.map((r) => (
          <button key={r} className={`chip rarity-${r.toLowerCase()} ${show === r ? 'on' : ''}`} onClick={() => setShow(r)}>
            {r} <small>{done(r)}/{COLLECTIONS.filter((c) => c.rarity === r).length}</small>{readyCount(r) > 0 && <span className="ready-dot"> ✨{readyCount(r)} ready</span>}
          </button>
        ))}
      </div>
      <p className="muted small">{show}: {RARITY_TEXT[show]}. {show === 'Common' || show === 'Uncommon' ? 'Wins a colour version of a skin.' : show === 'Legendary' ? 'Wins the Chess Chaos Crown army.' : 'Wins a brand-new skin.'}</p>
      <div className="set-grid">
        {COLLECTIONS.filter((c) => c.rarity === show).sort((a, b) => Number(isReady(b)) - Number(isReady(a)) || Number(owns(a)) - Number(owns(b))).map((c) => {
          const prog = setProgress(p.collection, c);
          const ready = !prog.missing.length;
          const have = owns(c);
          const info = skinInfo(c.skin);
          const price = SET_SKIN_PRICE[c.rarity];
          return (
            <div key={c.id} className={`set-card rarity-${c.rarity.toLowerCase()} ${have ? 'owned' : ''} ${ready && !have ? 'ready' : ''}`}>
              <svg viewBox="0 0 200 100" aria-hidden="true">
                <Character skin={c.skin} type="king" owner="p1" seed={3} />
                <g transform="translate(100 0)"><Character skin={c.skin} type="knight" owner="p2" seed={5} /></g>
              </svg>
              <b>{c.name}</b>
              <span className="set-pieces">
                {c.pieces.map((s) => <span key={s} className={prog.have.includes(s) ? 'got' : 'need'} title={`${SUIT_NAME[s]}: you have ${suitCount(p.collection, s)}`}>{SUIT_ICON[s]}<small className="set-have">{suitCount(p.collection, s)}</small></span>)}
              </span>
              <small>{info.name === c.name ? info.blurb : info.name}</small>
              {have ? <span className="pc-kind">✅ Unlocked</span> : (
                <span className="row wrap">
                  <button className="btn small primary" disabled={!ready} onClick={() => turnIn(c)}>{ready ? 'Turn in!' : `Need ${prog.missing.map((s) => SUIT_ICON[s]).join(' ')}`}</button>
                  {price !== undefined && <button className="btn small" disabled={p.coins < price} onClick={() => buy(c, price)}>🪙 {price}</button>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Pick the cards for the next party match. Saved on the profile. */
export function HandPicker() {
  const save = useSave();
  const p = activeProfile(save);
  if (!p || !POWER_CARDS) return null;
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
  return p && POWER_CARDS ? currentHand(p.collection, p.partyHand) : [];
}
