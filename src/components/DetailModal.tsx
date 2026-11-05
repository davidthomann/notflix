import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { backdropImage, landscapeImage, logoImage, posterImage } from '../api/images';
import type { Item } from '../api/types';
import { useDetailLink, useItemActions, usePlay } from '../lib/actions';
import { episodeCode, formatRuntime, progressPercent, remainingLabel, scorePercent, seasonLabel, yearRange } from '../lib/format';
import { useIsMobile, useScrollLock } from '../lib/hooks';
import { useClient } from '../state/session';
import { updateSettings, useSettings } from '../state/settings';
import { MyListButton, RateButton } from './ActionButtons';
import { Art } from './Art';
import { Dropdown } from './Dropdown';
import { IconBack, IconCheck, IconChevronDown, IconClose, IconMuted, IconPlay, IconShare, IconVolume } from './Icons';
import { PreviewVideo, usePreviewUrl } from './Preview';

/** Renders the detail view whenever the URL carries `?jbv=<id>`. */
export function DetailModalHost() {
  const [params] = useSearchParams();
  const id = params.get('jbv');
  if (!id) return null;
  return createPortal(<DetailModal key={id} id={id} />, document.body);
}

function DetailModal({ id }: { id: string }) {
  const client = useClient();
  const detail = useDetailLink();
  const isMobile = useIsMobile();
  const dialog = useRef<HTMLDivElement>(null);
  useScrollLock(true);

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['item', id],
    queryFn: () => client.item(id),
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const close = detail.close;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key !== 'Tab' || !dialog.current) return;
      // Keep keyboard focus inside the dialog.
      const focusable = dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([tabindex="-1"]), [tabindex="0"]');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={item?.Name ?? 'Details'} tabIndex={-1} ref={dialog}>
        <button type="button" className="modal__close" aria-label={isMobile ? 'Zurück' : 'Schließen'} onClick={close}>
          {isMobile ? <IconBack /> : <IconClose />}
        </button>
        {isLoading && <div className="center-spinner modal__loading"><div className="spinner" /></div>}
        {isError && <p className="empty-note modal__loading">Dieser Titel konnte nicht geladen werden.</p>}
        {item && <DetailContent item={item} />}
      </div>
    </div>
  );
}

function useResumeTarget(item: Item) {
  const client = useClient();
  const isSeries = item.Type === 'Series';
  const { data: nextUp } = useQuery({
    queryKey: ['nextup', 'series', item.Id],
    enabled: isSeries,
    queryFn: async () => (await client.nextUp({ seriesId: item.Id, limit: 1 })).Items[0] ?? null,
  });
  return isSeries ? (nextUp ?? null) : item;
}

function DetailContent({ item }: { item: Item }) {
  const client = useClient();
  const play = usePlay();
  const isMobile = useIsMobile();
  const { previewsMuted } = useSettings();
  const clip = usePreviewUrl(item, !isMobile);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<'main' | 'similar' | 'trailers'>('main');
  const { played } = useItemActions(item);
  const target = useResumeTarget(item);

  const isSeries = item.Type === 'Series';
  const isCollection = item.Type === 'BoxSet';
  const backdrop = backdropImage(client.serverUrl, item, 1280);
  const logo = logoImage(client.serverUrl, item, 500);
  const score = scorePercent(item);
  const progress = target && target.Type !== 'Series' ? progressPercent(target) : 0;
  const resuming = (target?.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const runtime = isSeries ? seasonLabel(item) : isCollection ? '' : formatRuntime(item.RunTimeTicks);
  const trailers = item.RemoteTrailers?.filter((t) => t.Url) ?? [];
  const hasTrailers = trailers.length > 0 || Boolean(item.LocalTrailerCount);

  const people = item.People ?? [];
  const cast = people.filter((p) => p.Type === 'Actor');
  const directors = people.filter((p) => p.Type === 'Director');
  const writers = people.filter((p) => p.Type === 'Writer');

  const playLabel = resuming ? 'Fortsetzen' : 'Abspielen';
  const episodeHint = isSeries && target ? episodeCode(target) : '';

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: item.Name, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  const tabs: { key: typeof tab; label: string; show: boolean }[] = [
    { key: 'main', label: isSeries ? 'Folgen' : isCollection ? 'Titel' : 'Details', show: true },
    { key: 'similar', label: 'Mehr davon', show: !isCollection },
    { key: 'trailers', label: 'Trailer', show: hasTrailers },
  ];

  const showMain = !isMobile || tab === 'main';
  const showSimilar = !isMobile || tab === 'similar';
  const showTrailers = !isMobile || tab === 'trailers';

  return (
    <>
      <div className="modal__hero">
        {backdrop && <Art src={backdrop} />}
        <PreviewVideo src={clip} muted={previewsMuted} delayMs={800} onPlayingChange={setPlaying} />
        <div className="modal__hero-fade" />
        <div className="modal__hero-info">
          {logo ? <img className="modal__logo" src={logo} alt={item.Name} /> : <h2 className="modal__title">{item.Name}</h2>}
          <div className="modal__actions">
            <button type="button" className="btn btn--white" onClick={() => void play(target ?? item)}>
              <IconPlay /> {playLabel}
            </button>
            <MyListButton item={item} large />
            <RateButton item={item} large />
            {playing && (
              <button
                type="button"
                className="round-btn round-btn--lg modal__mute"
                aria-label={previewsMuted ? 'Ton an' : 'Ton aus'}
                onClick={() => updateSettings({ previewsMuted: !previewsMuted })}
              >
                {previewsMuted ? <IconMuted /> : <IconVolume />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="modal__body">
        <div className="modal__columns">
          <div className="modal__main">
            <div className="meta-line meta-line--lg">
              {score !== null && <span className="score">{score} % Bewertung</span>}
              {yearRange(item) && <span>{yearRange(item)}</span>}
              {item.OfficialRating && <span className="age-badge">{item.OfficialRating}</span>}
              {runtime && <span>{runtime}</span>}
              {item.IsHD && <span className="hd-badge">HD</span>}
            </div>
            {progress > 0 && (
              <div className="modal__progress">
                <div className="progress">
                  <div className="progress__fill" style={{ width: `${progress}%` }} />
                </div>
                <span>{remainingLabel(target!)}</span>
              </div>
            )}
            {episodeHint && (
              <p className="modal__next">
                <strong>{resuming ? 'Weiter mit' : 'Als Nächstes'} {episodeHint}:</strong> {target?.Name}
              </p>
            )}
            {item.Taglines?.[0] && <p className="modal__tagline">{item.Taglines[0]}</p>}
            {item.Overview && <p className="modal__overview">{item.Overview}</p>}
            {isMobile && (
              <div className="modal__mobile-actions">
                {!isSeries && !isCollection && (
                  <button type="button" className="text-action" aria-pressed={Boolean(item.UserData?.Played)} onClick={() => played.mutate(!item.UserData?.Played)}>
                    <IconCheck />
                    <span>{item.UserData?.Played ? 'Gesehen' : 'Als gesehen markieren'}</span>
                  </button>
                )}
                <button type="button" className="text-action" onClick={() => void share()}>
                  <IconShare />
                  <span>Teilen</span>
                </button>
              </div>
            )}
          </div>
          <aside className="modal__side">
            <TagLine label="Besetzung" people={cast.slice(0, 4)} />
            <GenreLine item={item} />
            {item.Tags && item.Tags.length > 0 && (
              <p className="tag-line">
                <span>Dieser Titel ist:</span> {item.Tags.slice(0, 3).join(', ')}
              </p>
            )}
          </aside>
        </div>

        {isMobile && (
          <div className="modal__tabs" role="tablist">
            {tabs.filter((t) => t.show).map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {showMain && isSeries && <EpisodesSection series={item} currentEpisode={target} />}
        {showMain && isCollection && <CollectionSection item={item} />}
        {showSimilar && !isCollection && <SimilarSection item={item} />}
        {showTrailers && hasTrailers && <TrailersSection item={item} remote={trailers} />}

        {showMain && (
          <section className="modal__section modal__about">
            <h3>Über {item.Name}</h3>
            <TagLine label="Regie" people={directors} />
            <TagLine label="Besetzung" people={cast.slice(0, 12)} />
            <TagLine label="Drehbuch" people={writers} />
            <GenreLine item={item} />
            {item.Studios && item.Studios.length > 0 && (
              <p className="tag-line">
                <span>Studio:</span> {item.Studios.map((s) => s.Name).join(', ')}
              </p>
            )}
            {item.OfficialRating && (
              <p className="tag-line">
                <span>Altersfreigabe:</span> <span className="age-badge">{item.OfficialRating}</span>
              </p>
            )}
            {!isMobile && !isSeries && !isCollection && (
              <button type="button" className="link-btn" onClick={() => played.mutate(!item.UserData?.Played)}>
                {item.UserData?.Played ? 'Als ungesehen markieren' : 'Als gesehen markieren'}
              </button>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function TagLine({ label, people }: { label: string; people: { Id: string; Name: string }[] }) {
  if (people.length === 0) return null;
  return (
    <p className="tag-line">
      <span>{label}:</span>{' '}
      {people.map((p, i) => (
        <span key={`${p.Id}-${i}`}>
          <Link to={`/browse/person/${p.Id}?name=${encodeURIComponent(p.Name)}`}>{p.Name}</Link>
          {i < people.length - 1 ? ', ' : ''}
        </span>
      ))}
    </p>
  );
}

function GenreLine({ item }: { item: Item }) {
  const genres = item.GenreItems ?? [];
  if (genres.length === 0) return null;
  return (
    <p className="tag-line">
      <span>Genres:</span>{' '}
      {genres.map((g, i) => (
        <span key={g.Id}>
          <Link to={`/browse/genre/${g.Id}?name=${encodeURIComponent(g.Name)}`}>{g.Name}</Link>
          {i < genres.length - 1 ? ', ' : ''}
        </span>
      ))}
    </p>
  );
}

function EpisodesSection({ series, currentEpisode }: { series: Item; currentEpisode: Item | null }) {
  const client = useClient();
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const { data: seasons } = useQuery({
    queryKey: ['seasons', series.Id],
    queryFn: async () => (await client.seasons(series.Id)).Items,
  });

  const active = seasonId ?? currentEpisode?.SeasonId ?? seasons?.[0]?.Id ?? null;

  const { data: episodes, isLoading } = useQuery({
    queryKey: ['episodes', series.Id, active],
    enabled: Boolean(active),
    queryFn: async () => (await client.episodes(series.Id, { seasonId: active! })).Items,
  });

  return (
    <section className="modal__section">
      <div className="episodes__head">
        <h3>Folgen</h3>
        {seasons && seasons.length > 1 ? (
          <Dropdown
            label="Staffel wählen"
            value={active ?? undefined}
            options={seasons.map((s) => ({ value: s.Id, label: s.Name }))}
            onChange={(v) => setSeasonId(v)}
          />
        ) : (
          seasons?.[0] && <span className="episodes__season">{seasons[0].Name}</span>
        )}
      </div>
      {isLoading && <div className="center-spinner"><div className="spinner" /></div>}
      <ol className="episodes">
        {episodes?.map((ep) => <EpisodeRow key={ep.Id} episode={ep} current={ep.Id === currentEpisode?.Id} />)}
      </ol>
    </section>
  );
}

function EpisodeRow({ episode, current }: { episode: Item; current: boolean }) {
  const client = useClient();
  const navigate = useNavigate();
  const still = landscapeImage(client.serverUrl, episode, 400);
  const progress = progressPercent(episode);
  return (
    <li className={current ? 'is-current' : ''}>
      <button type="button" className="episode" onClick={() => navigate(`/watch/${episode.Id}`)}>
        <span className="episode__index">{episode.IndexNumber ?? ''}</span>
        <span className="episode__still">
          {still ? <img src={still} alt="" loading="lazy" /> : <span className="card__fallback" />}
          <span className="episode__play" aria-hidden="true">
            <IconPlay />
          </span>
          {progress > 0 && (
            <span className="progress episode__progress">
              <span className="progress__fill" style={{ width: `${progress}%` }} />
            </span>
          )}
        </span>
        <span className="episode__text">
          <span className="episode__title">
            <strong>{episode.Name}</strong>
            <span>{formatRuntime(episode.RunTimeTicks)}</span>
          </span>
          {episode.Overview && <span className="episode__overview">{episode.Overview}</span>}
        </span>
      </button>
    </li>
  );
}

function CollectionSection({ item }: { item: Item }) {
  const client = useClient();
  const { data } = useQuery({
    queryKey: ['collection', item.Id],
    queryFn: async () => (await client.items({ parentId: item.Id, recursive: false, sortBy: 'ProductionYear,SortName' })).Items,
  });
  if (!data?.length) return null;
  return (
    <section className="modal__section">
      <h3>In dieser Sammlung</h3>
      <div className="more-grid">
        {data.map((entry) => <MoreCard key={entry.Id} item={entry} />)}
      </div>
    </section>
  );
}

function SimilarSection({ item }: { item: Item }) {
  const client = useClient();
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ['similar', item.Id],
    queryFn: async () => (await client.similar(item.Id)).Items,
  });
  if (!data?.length) return null;
  const visible = expanded ? data : data.slice(0, 9);
  return (
    <section className="modal__section">
      <h3>Mehr davon</h3>
      <div className="more-grid">
        {visible.map((entry) => <MoreCard key={entry.Id} item={entry} />)}
      </div>
      {data.length > 9 && (
        <div className="more-toggle">
          <button type="button" className="round-btn" aria-label={expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'} aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            <IconChevronDown style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
          </button>
        </div>
      )}
    </section>
  );
}

function MoreCard({ item }: { item: Item }) {
  const client = useClient();
  const detail = useDetailLink();
  const play = usePlay();
  const isMobile = useIsMobile();
  const art = isMobile ? posterImage(client.serverUrl, item, 300) : landscapeImage(client.serverUrl, item, 400);
  const score = scorePercent(item);
  const runtime = item.Type === 'Series' ? seasonLabel(item) : formatRuntime(item.RunTimeTicks);
  return (
    <article className="more-card">
      <Link to={detail.hrefFor(item)} {...detail.stateFor()} className="more-card__art" aria-label={item.Name}>
        {art ? <img src={art} alt="" loading="lazy" /> : <span className="card__fallback">{item.Name}</span>}
        {runtime && !isMobile && <span className="more-card__duration">{runtime}</span>}
        {!isMobile && <span className="more-card__name">{item.Name}</span>}
      </Link>
      {!isMobile && (
        <div className="more-card__body">
          <div className="more-card__row">
            <div className="meta-line">
              {score !== null && <span className="score">{score} %</span>}
              {item.OfficialRating && <span className="age-badge">{item.OfficialRating}</span>}
              {item.ProductionYear && <span>{item.ProductionYear}</span>}
            </div>
            <div className="more-card__buttons">
              <button type="button" className="round-btn" aria-label={`${item.Name} abspielen`} onClick={() => void play(item)}>
                <IconPlay />
              </button>
              <MyListButton item={item} />
            </div>
          </div>
          {item.Overview && <p>{item.Overview}</p>}
        </div>
      )}
    </article>
  );
}

function TrailersSection({ item, remote }: { item: Item; remote: { Url?: string | null; Name?: string | null }[] }) {
  const client = useClient();
  const navigate = useNavigate();
  const { data: local } = useQuery({
    queryKey: ['trailers', item.Id],
    enabled: Boolean(item.LocalTrailerCount),
    queryFn: () => client.localTrailers(item.Id),
  });
  const art = landscapeImage(client.serverUrl, item, 400);
  return (
    <section className="modal__section">
      <h3>Trailer und mehr</h3>
      <div className="more-grid">
        {local?.map((t) => (
          <button type="button" key={t.Id} className="trailer-card" onClick={() => navigate(`/watch/${t.Id}?t=0`)}>
            <span className="trailer-card__art">
              {art && <img src={art} alt="" loading="lazy" />}
              <span className="episode__play" aria-hidden="true"><IconPlay /></span>
            </span>
            <span>{t.Name}</span>
          </button>
        ))}
        {remote.map((t, i) => (
          <a key={`${t.Url}-${i}`} className="trailer-card" href={t.Url!} target="_blank" rel="noreferrer noopener">
            <span className="trailer-card__art">
              {art && <img src={art} alt="" loading="lazy" />}
              <span className="episode__play" aria-hidden="true"><IconPlay /></span>
            </span>
            <span>{t.Name || 'Trailer'}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
