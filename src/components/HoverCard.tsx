import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { landscapeSource, logoImage } from '../api/images';
import type { Item } from '../api/types';
import { useDetailLink, useItemActions, usePlay } from '../lib/actions';
import { displayTitle, episodeCode, formatRuntime, progressPercent, remainingLabel, scorePercent, seasonLabel } from '../lib/format';
import { useClient } from '../state/session';
import { useSettings, updateSettings } from '../state/settings';
import { MyListButton, RateButton } from './ActionButtons';
import { Art } from './Art';
import { IconChevronDown, IconClose, IconMuted, IconPlay, IconVolume } from './Icons';
import { PreviewVideo, usePreviewUrl } from './Preview';

const OPEN_DELAY = 450;
const CLOSE_DELAY = 120;

interface HoverTarget {
  item: Item;
  rect: DOMRect;
  removable: boolean;
}

interface HoverApi {
  schedule: (target: HoverTarget) => void;
  cancel: () => void;
}

const HoverContext = createContext<HoverApi | null>(null);
export const useHover = () => useContext(HoverContext);

export function HoverProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HoverTarget | null>(null);
  const timer = useRef<number>(0);
  const location = useLocation();

  const clear = () => window.clearTimeout(timer.current);

  const api = useMemo<HoverApi>(
    () => ({
      schedule: (next) => {
        clear();
        timer.current = window.setTimeout(() => setTarget(next), OPEN_DELAY);
      },
      cancel: () => {
        clear();
        timer.current = window.setTimeout(() => setTarget(null), CLOSE_DELAY);
      },
    }),
    [],
  );

  useEffect(() => {
    clear();
    setTarget(null);
  }, [location.pathname, location.search]);

  useEffect(() => clear, []);

  const hold = useCallback(clear, []);

  return (
    <HoverContext.Provider value={api}>
      {children}
      {target &&
        createPortal(
          <HoverPanel key={target.item.Id} target={target} onEnter={hold} onLeave={api.cancel} />,
          document.body,
        )}
    </HoverContext.Provider>
  );
}

function placement(rect: DOMRect) {
  const width = Math.max(rect.width * 1.5, 300);
  const artHeight = (width * 9) / 16;
  const viewport = document.documentElement.clientWidth;
  const margin = viewport * 0.015;
  const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), viewport - width - margin);
  const top = Math.max(window.scrollY + 8, rect.top + window.scrollY + rect.height / 2 - artHeight / 2);
  const originX = ((rect.left + rect.width / 2 - left) / width) * 100;
  return { width, left, top, originX, scale: rect.width / width };
}

function HoverPanel({ target, onEnter, onLeave }: { target: HoverTarget; onEnter: () => void; onLeave: () => void }) {
  const { item: initial, rect, removable } = target;
  const client = useClient();
  const play = usePlay();
  const detail = useDetailLink();
  const { previewsMuted } = useSettings();
  const place = useMemo(() => placement(rect), [rect]);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const item = useLiveItem(initial);
  const { removeFromRow } = useItemActions(item);
  const clip = usePreviewUrl(item, true);

  const source = landscapeSource(client.serverUrl, item, 640);
  const art = source?.url;
  const logo = source?.hasTitle ? null : logoImage(client.serverUrl, item, 400);
  const score = scorePercent(item);
  const progress = progressPercent(item);
  const runtime = item.Type === 'Series' ? seasonLabel(item) : formatRuntime(item.RunTimeTicks);

  return (
    <div
      className="hover-card"
      role="group"
      aria-label={displayTitle(item)}
      style={
        {
          width: place.width,
          left: place.left,
          top: place.top,
          transformOrigin: `${place.originX}% 25%`,
          '--from-scale': place.scale,
        } as React.CSSProperties
      }
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={() => detail.open(item)}
    >
      <div className="hover-card__art">
        {art ? <Art src={art} /> : <div className="card__fallback">{displayTitle(item)}</div>}
        <PreviewVideo src={clip} muted={previewsMuted} delayMs={500} onPlayingChange={setVideoPlaying} />
        <div className="hover-card__fade" />
        {logo ? <Art className="hover-card__logo" src={logo} alt={displayTitle(item)} /> : !source?.hasTitle && <div className="hover-card__name">{displayTitle(item)}</div>}
        {videoPlaying && (
          <button
            type="button"
            className="round-btn round-btn--sm hover-card__mute"
            aria-label={previewsMuted ? 'Ton an' : 'Ton aus'}
            onClick={(e) => {
              e.stopPropagation();
              updateSettings({ previewsMuted: !previewsMuted });
            }}
          >
            {previewsMuted ? <IconMuted /> : <IconVolume />}
          </button>
        )}
      </div>
      <div className="hover-card__body">
        <div className="hover-card__actions">
          <button
            type="button"
            className="round-btn round-btn--play"
            aria-label={`${displayTitle(item)} abspielen`}
            onClick={(e) => {
              e.stopPropagation();
              void play(item);
            }}
          >
            <IconPlay />
          </button>
          <MyListButton item={item} />
          <RateButton item={item} />
          {removable && (
            <button
              type="button"
              className="round-btn"
              aria-label="Aus Reihe entfernen"
              title="Aus Reihe entfernen"
              onClick={(e) => {
                e.stopPropagation();
                removeFromRow.mutate();
                onLeave();
              }}
            >
              <IconClose />
            </button>
          )}
          <button
            type="button"
            className="round-btn hover-card__more"
            aria-label="Weitere Infos"
            title="Weitere Infos"
            onClick={(e) => {
              e.stopPropagation();
              detail.open(item);
            }}
          >
            <IconChevronDown />
          </button>
        </div>
        <div className="meta-line">
          {score !== null && <span className="score">{score} % Bewertung</span>}
          {item.OfficialRating && <span className="age-badge">{item.OfficialRating}</span>}
          {runtime && <span>{runtime}</span>}
          {item.IsHD && <span className="hd-badge">HD</span>}
        </div>
        {item.Type === 'Episode' && (
          <div className="hover-card__episode">
            {episodeCode(item)} <span>„{item.Name}“</span>
          </div>
        )}
        {progress > 0 && (
          <div className="hover-card__progress">
            <div className="progress">
              <div className="progress__fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{remainingLabel(item)}</span>
          </div>
        )}
        {item.Genres && item.Genres.length > 0 && (
          <ul className="genre-dots">
            {item.Genres.slice(0, 3).map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Reads the freshest cached copy so "Meine Liste"/rating changes show up while the panel is open. */
function useLiveItem(initial: Item): Item {
  const qc = useQueryClient();
  useIsMutating(); // Re-render whenever a user-data mutation starts or settles.
  let found: Item = initial;
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (obj.Id === initial.Id && 'Type' in obj) {
        found = obj as unknown as Item;
        return true;
      }
      return visit(obj.Items) || visit(obj.pages);
    }
    return false;
  };
  for (const query of qc.getQueryCache().getAll()) {
    if (visit(query.state.data)) break;
  }
  return found;
}
