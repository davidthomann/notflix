import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { backdropImage, logoImage, posterImage } from '../api/images';
import type { Item } from '../api/types';
import { useDetailLink, usePlay } from '../lib/actions';
import { useIsMobile } from '../lib/hooks';
import { useClient } from '../state/session';
import { updateSettings, useSettings } from '../state/settings';
import { MyListButton } from './ActionButtons';
import { Art } from './Art';
import { IconInfo, IconMuted, IconPlay, IconReplay, IconVolume } from './Icons';
import { PreviewVideo, usePreviewUrl } from './Preview';

/** Prefers a random title that has both backdrop and logo art, which gives the hero its full look. */
export function useBillboardItem(types: string[]) {
  const client = useClient();
  return useQuery({
    queryKey: ['billboard', types.join(',')],
    staleTime: Infinity,
    queryFn: async () => {
      const res = await client.items({
        includeItemTypes: types,
        sortBy: 'Random',
        limit: 15,
        imageTypes: 'Backdrop',
        hasOverview: true,
      });
      return res.Items.find((i) => i.ImageTags?.Logo) ?? res.Items[0] ?? null;
    },
  });
}

export function Billboard({ item }: { item: Item }) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileHero item={item} /> : <DesktopBillboard item={item} />;
}

function DesktopBillboard({ item }: { item: Item }) {
  const client = useClient();
  const play = usePlay();
  const detail = useDetailLink();
  const { previewsMuted } = useSettings();
  const clip = usePreviewUrl(item, true);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const backdrop = backdropImage(client.serverUrl, item);
  const logo = logoImage(client.serverUrl, item);
  const [logoFailed, setLogoFailed] = useState(false);
  const [infoReady, setInfoReady] = useState(!logo);

  // The text waits for the logo so the title never pops in above it, but not for long.
  useEffect(() => {
    const id = window.setTimeout(() => setInfoReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section className={`billboard${playing ? ' is-playing' : ''}`} aria-label={item.Name}>
      <div className="billboard__media">
        {backdrop && <Art src={backdrop} />}
        {!ended && (
          <PreviewVideo
            src={clip}
            muted={previewsMuted}
            delayMs={2500}
            replayKey={replayKey}
            onPlayingChange={setPlaying}
            onEnded={() => setEnded(true)}
          />
        )}
        <div className="billboard__vignette" />
        <div className="billboard__fade" />
      </div>
      <div className={`billboard__info${infoReady ? ' is-ready' : ''}`}>
        {logo && !logoFailed ? (
          <Art className="billboard__logo" src={logo} alt={item.Name} onReady={() => setInfoReady(true)} onFail={() => { setLogoFailed(true); setInfoReady(true); }} />
        ) : (
          <h1 className="billboard__title">{item.Name}</h1>
        )}
        {item.Overview && <p className="billboard__overview">{item.Overview}</p>}
        <div className="billboard__actions">
          <button type="button" className="btn btn--white" onClick={() => void play(item)}>
            <IconPlay /> Abspielen
          </button>
          <button type="button" className="btn btn--gray" onClick={() => detail.open(item)}>
            <IconInfo /> Weitere Infos
          </button>
        </div>
      </div>
      <div className="billboard__side">
        {(playing || ended) && (
          <button
            type="button"
            className="round-btn"
            aria-label={ended ? 'Erneut abspielen' : previewsMuted ? 'Ton an' : 'Ton aus'}
            onClick={() => {
              if (ended) {
                setEnded(false);
                setReplayKey((k) => k + 1);
              } else {
                updateSettings({ previewsMuted: !previewsMuted });
              }
            }}
          >
            {ended ? <IconReplay /> : previewsMuted ? <IconMuted /> : <IconVolume />}
          </button>
        )}
        {item.OfficialRating && <span className="billboard__rating">{item.OfficialRating}</span>}
      </div>
    </section>
  );
}

function MobileHero({ item }: { item: Item }) {
  const client = useClient();
  const play = usePlay();
  const detail = useDetailLink();
  const poster = posterImage(client.serverUrl, item, 720);
  const logo = logoImage(client.serverUrl, item, 500);

  return (
    <section className="mobile-hero" aria-label={item.Name}>
      <div className="mobile-hero__glow" style={poster ? { backgroundImage: `url("${poster}")` } : undefined} />
      <div className="mobile-hero__card" onClick={() => detail.open(item)}>
        {poster && <Art className="mobile-hero__poster" src={poster} />}
        <div className="mobile-hero__shade" />
        <div className="mobile-hero__content">
          {logo ? <img className="mobile-hero__logo" src={logo} alt={item.Name} /> : <h1 className="mobile-hero__title">{item.Name}</h1>}
          {item.Genres && item.Genres.length > 0 && (
            <ul className="genre-dots genre-dots--center">
              {item.Genres.slice(0, 3).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
          <div className="mobile-hero__actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn--white" onClick={() => void play(item)}>
              <IconPlay /> Abspielen
            </button>
            <MobileListButton item={item} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileListButton({ item }: { item: Item }) {
  return (
    <div className="mobile-hero__list">
      <MyListButton item={item} />
      <span>Meine Liste</span>
    </div>
  );
}
