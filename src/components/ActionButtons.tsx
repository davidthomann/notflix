import type { Item } from '../api/types';
import { useItemActions } from '../lib/actions';
import { IconCheck, IconPlus, IconThumbDown, IconThumbUp } from './Icons';

export function MyListButton({ item, large }: { item: Item; large?: boolean }) {
  const { favorite } = useItemActions(item);
  const on = Boolean(item.UserData?.IsFavorite);
  const label = on ? 'Aus Meine Liste entfernen' : 'Zu Meine Liste hinzufügen';
  return (
    <button
      type="button"
      className={`round-btn${large ? ' round-btn--lg' : ''}`}
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        favorite.mutate(!on);
      }}
    >
      {on ? <IconCheck /> : <IconPlus />}
    </button>
  );
}

/** Thumb rating backed by Jellyfin's `Likes` flag: up, down or (clicking again) cleared. */
export function RateButton({ item, large }: { item: Item; large?: boolean }) {
  const { rate } = useItemActions(item);
  const likes = item.UserData?.Likes;
  const set = (e: React.MouseEvent, value: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    rate.mutate(likes === value ? null : value);
  };
  const sizeClass = large ? ' round-btn--lg' : '';
  return (
    <div className="rate">
      <button type="button" className={`round-btn${sizeClass}`} aria-label="Bewertung" tabIndex={-1}>
        {likes === false ? <IconThumbDown className="is-filled" /> : <IconThumbUp className={likes ? 'is-filled' : ''} />}
      </button>
      <div className="rate__pop" role="group" aria-label="Bewerten">
        <button type="button" className="rate__opt" aria-label="Nichts für mich" aria-pressed={likes === false} title="Nichts für mich" onClick={(e) => set(e, false)}>
          <IconThumbDown className={likes === false ? 'is-filled' : ''} />
        </button>
        <button type="button" className="rate__opt" aria-label="Gefällt mir" aria-pressed={likes === true} title="Gefällt mir" onClick={(e) => set(e, true)}>
          <IconThumbUp className={likes ? 'is-filled' : ''} />
        </button>
      </div>
    </div>
  );
}
