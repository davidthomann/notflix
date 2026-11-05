import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { landscapeSource, logoImage, posterImage } from '../api/images';
import type { Item } from '../api/types';
import { useDetailLink, usePlay } from '../lib/actions';
import { displayTitle, episodeCode, freshBadge, progressPercent } from '../lib/format';
import { useCanHover, useIsMobile } from '../lib/hooks';
import { useClient } from '../state/session';
import { Art } from './Art';
import { useHover } from './HoverCard';
import { IconInfo, IconPlay } from './Icons';

export type CardVariant = 'wide' | 'poster' | 'resume' | 'top10';

interface CardProps {
  item: Item;
  variant?: CardVariant;
  rank?: number;
}

export function Card({ item, variant = 'wide', rank }: CardProps) {
  const client = useClient();
  const isMobile = useIsMobile();
  const canHover = useCanHover();
  const hover = useHover();
  const detail = useDetailLink();
  const play = usePlay();
  const ref = useRef<HTMLAnchorElement>(null);
  const [artFailed, setArtFailed] = useState(false);

  const isResume = variant === 'resume';
  const usePoster = variant === 'poster' || variant === 'top10' || isMobile;
  const wide = landscapeSource(client.serverUrl, item, 640);
  const art = artFailed ? null : usePoster ? posterImage(client.serverUrl, item, 400) : wide?.url;
  // Thumb artwork already has the title painted in; another title on top would read double.
  const needsTitle = !usePoster && !wide?.hasTitle;
  const logo = needsTitle ? logoImage(client.serverUrl, item, 300) : null;
  const progress = progressPercent(item);
  const title = displayTitle(item);
  const code = episodeCode(item);
  const badge = isResume || variant === 'top10' ? null : freshBadge(item);

  const hoverHandlers =
    canHover && hover
      ? {
          onMouseEnter: () => {
            const el = ref.current;
            if (el) hover.schedule({ item, rect: el.getBoundingClientRect(), removable: isResume && progress > 0 });
          },
          onMouseLeave: () => hover.cancel(),
        }
      : {};

  const classes = ['card', usePoster ? 'card--poster' : 'card--wide', variant === 'top10' ? 'card--top10' : ''].join(' ');

  return (
    <div className={classes}>
      {variant === 'top10' && rank !== undefined && (
        <svg className="card__rank" viewBox="0 0 100 150" aria-hidden="true">
          <text x="100%" y="128" textAnchor="end">
            {rank}
          </text>
        </svg>
      )}
      <Link
        ref={ref}
        className="card__link"
        to={detail.hrefFor(item)}
        {...detail.stateFor()}
        aria-label={code ? `${title}, ${code}` : title}
        onClick={(e) => {
          if (isResume) {
            e.preventDefault();
            void play(item);
          }
        }}
        {...hoverHandlers}
      >
        {art ? <Art src={art} loading="lazy" decoding="async" onFail={() => setArtFailed(true)} /> : <div className="card__fallback">{title}</div>}
        {art && needsTitle && (logo ? <Art className="card__logo" src={logo} loading="lazy" /> : <div className="card__title">{title}</div>)}
        {art && usePoster && !item.ImageTags?.Primary && !item.SeriesPrimaryImageTag && <div className="card__title">{title}</div>}
        {badge && <span className="card__badge">{badge}</span>}
        {isResume && isMobile && (
          <span className="card__play" aria-hidden="true">
            <IconPlay />
          </span>
        )}
        {progress > 0 && progress < 100 && (
          <div className="progress card__progress" aria-hidden="true">
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </Link>
      {isResume && isMobile && (
        <div className="card__footer">
          <span>{code || ' '}</span>
          <button type="button" className="icon-btn" aria-label={`Infos zu ${title}`} onClick={() => detail.open(item)}>
            <IconInfo width={18} height={18} />
          </button>
        </div>
      )}
    </div>
  );
}
