import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { backdropImage, landscapeImage } from '../api/images';
import type { Item, MediaSegment, MediaStream } from '../api/types';
import {
  IconBack,
  IconCheck,
  IconEpisodes,
  IconFullscreen,
  IconFullscreenExit,
  IconLock,
  IconMuted,
  IconNext,
  IconPause,
  IconPlay,
  IconSkip,
  IconSpeed,
  IconSubtitles,
  IconVolume,
  IconVolumeLow,
  IconWarning,
} from '../components/Icons';
import { resolvePlayable } from '../lib/actions';
import { episodeCode, formatRuntime, ticksToSeconds } from '../lib/format';
import { useCanHover } from '../lib/hooks';
import { useClient } from '../state/session';
import { getSettings, updateSettings, useSettings } from '../state/settings';
import { Scrubber } from './Scrubber';
import { SUBTITLES_OFF, useStream } from './useStream';

const SEEK_STEP = 10;
const IDLE_MS = 3000;
const PAUSE_INFO_MS = 6000;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

type Panel = 'episodes' | 'tracks' | 'speed' | null;

export default function WatchPage() {
  const { id = '' } = useParams();
  return <Player key={id} id={id} />;
}

function trackLabel(stream: MediaStream): string {
  return stream.DisplayTitle || stream.Title || stream.Language || `Spur ${stream.Index}`;
}

function Player({ id }: { id: string }) {
  const client = useClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const canHover = useCanHover();
  const settings = useSettings();

  const fromStart = params.get('t') === '0';
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);

  const { data: item, isError: itemFailed } = useQuery({
    queryKey: ['player-item', id],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: () => client.playerItem(id),
  });

  const isEpisode = item?.Type === 'Episode';
  const seriesId = item?.SeriesId;

  const { data: next } = useQuery({
    queryKey: ['next-episode', id],
    enabled: Boolean(isEpisode && seriesId),
    queryFn: async () => {
      const res = await client.episodes(seriesId!, { startItemId: id, limit: 2 });
      return res.Items.find((ep) => ep.Id !== id) ?? null;
    },
  });

  const { data: segments = [] } = useQuery<MediaSegment[]>({
    queryKey: ['segments', id],
    enabled: Boolean(item),
    queryFn: () => client.mediaSegments(id),
  });

  // A series or collection opened by URL resolves to the title that should actually play.
  useEffect(() => {
    if (!item?.IsFolder) return;
    void resolvePlayable(client, item).then((target) => {
      if (target && target.Id !== id) navigate(`/watch/${target.Id}`, { replace: true });
    });
  }, [item, id, client, navigate]);

  const startSeconds = useMemo(() => {
    if (!item || item.IsFolder) return null;
    return fromStart ? 0 : ticksToSeconds(item.UserData?.PlaybackPositionTicks ?? 0);
    // The resume point is read once; later refetches of the item must not restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.Id, fromStart]);

  const playback = useStream(videoRef, client, item, startSeconds);
  const { stream, subtitleUrl } = playback;

  // --- Media element state
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [ended, setEnded] = useState(false);
  const [rate, setRate] = useState(1);
  const [cues, setCues] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // --- UI state
  const [controlsVisible, setControlsVisible] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [creditsDismissed, setCreditsDismissed] = useState(false);
  const [pauseInfo, setPauseInfo] = useState(false);
  const [seekFlash, setSeekFlash] = useState<{ side: 'back' | 'forward'; key: number } | null>(null);
  const idleTimer = useRef(0);
  const lastTap = useRef(0);
  const tapTimer = useRef(0);

  const totalDuration = duration || (item?.RunTimeTicks ? ticksToSeconds(item.RunTimeTicks) : 0);

  const goBack = useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/browse', { replace: true });
  }, [location.key, navigate]);

  const wake = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setControlsVisible(false), IDLE_MS);
  }, []);

  useEffect(() => {
    wake();
    return () => window.clearTimeout(idleTimer.current);
  }, [wake]);

  const playNext = useCallback(() => {
    if (next) navigate(`/watch/${next.Id}`, { replace: true });
  }, [next, navigate]);

  // Wire media events.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = getSettings().volume;
    el.muted = getSettings().muted;
    const onPlay = () => {
      setPaused(false);
      setEnded(false);
      playback.clearGesture();
    };
    const onPause = () => setPaused(true);
    const onTime = () => setTime(el.currentTime);
    const onDuration = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onProgress = () => {
      if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1));
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onEnded = () => setEnded(true);
    const onVolume = () => updateSettings({ volume: el.volume, muted: el.muted });
    const pairs: [string, EventListener][] = [
      ['play', onPlay], ['pause', onPause], ['timeupdate', onTime], ['durationchange', onDuration],
      ['progress', onProgress], ['waiting', onWaiting], ['seeking', onWaiting], ['playing', onPlaying],
      ['seeked', onPlaying], ['canplay', onPlaying], ['ended', onEnded], ['volumechange', onVolume],
    ];
    pairs.forEach(([name, fn]) => el.addEventListener(name, fn));
    return () => pairs.forEach(([name, fn]) => el.removeEventListener(name, fn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep controls up while paused, in a panel or while scrubbing.
  useEffect(() => {
    if (paused || panel || scrubbing) {
      window.clearTimeout(idleTimer.current);
      setControlsVisible(true);
    } else {
      wake();
    }
  }, [paused, panel, scrubbing, wake]);

  // "Du siehst gerade": title overlay after a while in pause.
  useEffect(() => {
    setPauseInfo(false);
    if (!paused || ended || panel || !canHover) return;
    const t = window.setTimeout(() => setPauseInfo(true), PAUSE_INFO_MS);
    return () => window.clearTimeout(t);
  }, [paused, ended, panel, canHover, time]);

  // Subtitles are parsed by the browser's <track> and drawn by the overlay for consistent styling.
  useEffect(() => {
    setCues([]);
    const track = trackRef.current?.track;
    if (!track) return;
    track.mode = 'hidden';
    const onCue = () => {
      const active = track.activeCues ? Array.from(track.activeCues) : [];
      setCues(active.map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, '')));
    };
    track.addEventListener('cuechange', onCue);
    return () => track.removeEventListener('cuechange', onCue);
  }, [subtitleUrl]);

  // Fullscreen state.
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // End of title: continue with the next episode or return to where the viewer came from.
  useEffect(() => {
    if (!ended) return;
    if (next && settings.autoplayNext) {
      playNext();
    } else if (!isEpisode || next === null) {
      goBack();
    }
  }, [ended, next, settings.autoplayNext, isEpisode, playNext, goBack]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : Infinity;
    el.currentTime = Math.max(0, Math.min(max, seconds));
    setTime(el.currentTime);
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const el = videoRef.current;
      if (!el) return;
      seekTo(el.currentTime + delta);
      setSeekFlash({ side: delta < 0 ? 'back' : 'forward', key: Date.now() });
    },
    [seekTo],
  );

  const toggleFullscreen = useCallback(async () => {
    const el = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const root = rootRef.current;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else if (root?.requestFullscreen) {
      await root.requestFullscreen().catch(() => undefined);
      // Phones: turn to landscape where the browser permits it.
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await orientation?.lock?.('landscape').catch(() => undefined);
    } else {
      el?.webkitEnterFullscreen?.();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (el) el.muted = !el.muted;
  }, []);

  const currentSegment = segments.find((s) => {
    const start = ticksToSeconds(s.StartTicks);
    const end = ticksToSeconds(s.EndTicks);
    return time >= start && time < end && (s.Type === 'Intro' || s.Type === 'Recap');
  });
  const outro = segments.find((s) => s.Type === 'Outro');
  const inCredits = Boolean(outro && time >= ticksToSeconds(outro.StartTicks));
  const nearEnd = totalDuration > 0 && totalDuration - time <= 30;
  const showNextPrompt = Boolean(next) && !creditsDismissed && (inCredits || nearEnd) && !scrubbing;

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = videoRef.current;
      if (!el) return;
      switch (e.key) {
        case ' ':
          if (target.tagName === 'BUTTON') return;
          e.preventDefault();
          togglePlay();
          break;
        case 'k':
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          seekBy(-SEEK_STEP);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          seekBy(SEEK_STEP);
          break;
        case 'ArrowUp':
          e.preventDefault();
          el.volume = Math.min(1, el.volume + 0.1);
          el.muted = false;
          break;
        case 'ArrowDown':
          e.preventDefault();
          el.volume = Math.max(0, el.volume - 0.1);
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          void toggleFullscreen();
          break;
        case 's':
          if (currentSegment) seekTo(ticksToSeconds(currentSegment.EndTicks));
          break;
        case 'n':
          playNext();
          break;
        case 'Escape':
          if (panel) setPanel(null);
          else if (!document.fullscreenElement) goBack();
          break;
        default:
          return;
      }
      wake();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, seekBy, toggleMute, toggleFullscreen, currentSegment, seekTo, playNext, panel, goBack, wake]);

  // OS media controls (lock screen, hardware keys).
  useEffect(() => {
    if (!item || !('mediaSession' in navigator)) return;
    const art = landscapeImage(client.serverUrl, item, 512);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.Name,
      artist: item.SeriesName ?? undefined,
      artwork: art ? [{ src: art, sizes: '512x288', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-SEEK_STEP));
    navigator.mediaSession.setActionHandler('seekforward', () => seekBy(SEEK_STEP));
    navigator.mediaSession.setActionHandler('nexttrack', next ? playNext : null);
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [item, next, client, seekBy, playNext]);

  // Pointer on the video surface: click toggles on desktop; on touch, tap shows controls and double tap seeks.
  const onSurfaceClick = (e: React.MouseEvent) => {
    if (locked) {
      wake();
      return;
    }
    if (panel) {
      setPanel(null);
      return;
    }
    if (canHover) {
      togglePlay();
      wake();
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 300) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = 0;
      const rect = e.currentTarget.getBoundingClientRect();
      seekBy(e.clientX < rect.left + rect.width / 2 ? -SEEK_STEP : SEEK_STEP);
      wake();
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      if (controlsVisible) {
        window.clearTimeout(idleTimer.current);
        setControlsVisible(false);
      } else {
        wake();
      }
    }, 300);
  };

  const trickplay = useMemo(() => {
    const sourceId = stream?.source.Id;
    const byWidth = sourceId ? item?.Trickplay?.[sourceId] : undefined;
    const entry = byWidth ? Object.values(byWidth).sort((a, b) => a.Width - b.Width)[0] : undefined;
    if (!entry || !sourceId) return null;
    return {
      info: entry,
      sheetUrl: (index: number) =>
        client.authedUrl(`/Videos/${id}/Trickplay/${entry.Width}/${index}.jpg`, { mediaSourceId: sourceId }),
    };
  }, [item, stream, client, id]);

  const titleLine = isEpisode ? (
    <>
      <strong>{item?.SeriesName}</strong> <span>{episodeCode(item!)}</span> <span>{item?.Name}</span>
    </>
  ) : (
    <strong>{item?.Name}</strong>
  );

  const backdrop = item ? backdropImage(client.serverUrl, item, 1280) : null;
  const errorMessage = itemFailed ? 'Dieser Titel konnte nicht geladen werden.' : playback.error;
  const showSpinner = !errorMessage && !ended && (waiting || !stream) && !paused;
  const showInitial = !stream && !errorMessage;

  return (
    <div
      ref={rootRef}
      className={`player${controlsVisible && !locked ? ' controls-on' : ''}${canHover ? '' : ' is-touch'}`}
      onMouseMove={canHover ? wake : undefined}
    >
      <video ref={videoRef} className="player__video" playsInline crossOrigin="anonymous" preload="auto" poster={backdrop ?? undefined}>
        {subtitleUrl && <track key={subtitleUrl} ref={trackRef} kind="subtitles" src={subtitleUrl} default />}
      </video>

      <div className="player__surface" onClick={onSurfaceClick} onDoubleClick={canHover ? () => void toggleFullscreen() : undefined} />

      {cues.length > 0 && (
        <div className="player__cues" aria-live="off">
          {cues.map((cue, i) => (
            <span key={i}>{cue}</span>
          ))}
        </div>
      )}

      {(showSpinner || showInitial) && (
        <div className="player__center" aria-label="Wird geladen" role="status">
          <div className="spinner spinner--lg" />
        </div>
      )}

      {seekFlash && (
        <div key={seekFlash.key} className={`seek-flash seek-flash--${seekFlash.side}`} aria-hidden="true" onAnimationEnd={() => setSeekFlash(null)}>
          <IconSkip direction={seekFlash.side} width={56} height={56} />
        </div>
      )}

      {playback.needsGesture && !errorMessage && (
        <button type="button" className="player__big-play" aria-label="Abspielen" onClick={togglePlay}>
          <IconPlay width={56} height={56} />
        </button>
      )}

      {pauseInfo && item && (
        <div className="pause-info" aria-hidden="true">
          <small>Du siehst gerade</small>
          <h2>{isEpisode ? item.SeriesName : item.Name}</h2>
          {isEpisode && <h3>{episodeCode(item)} „{item.Name}“</h3>}
          <p className="pause-info__meta">
            {item.ProductionYear} {item.OfficialRating && `· ${item.OfficialRating}`} {formatRuntime(item.RunTimeTicks) && `· ${formatRuntime(item.RunTimeTicks)}`}
          </p>
          {item.Overview && <p>{item.Overview}</p>}
          <small className="pause-info__paused">Pausiert</small>
        </div>
      )}

      {errorMessage && (
        <div className="player__error" role="alert">
          <IconWarning width={40} height={40} />
          <h2>Da ist etwas schiefgelaufen</h2>
          <p>{errorMessage}</p>
          <div>
            <button type="button" className="btn btn--white" onClick={playback.retry}>Erneut versuchen</button>
            <button type="button" className="btn btn--gray" onClick={goBack}>Zurück</button>
          </div>
        </div>
      )}

      {currentSegment && !errorMessage && (
        <button type="button" className="skip-btn" onClick={() => seekTo(ticksToSeconds(currentSegment.EndTicks))}>
          {currentSegment.Type === 'Intro' ? 'Intro überspringen' : 'Rückblick überspringen'}
        </button>
      )}

      {showNextPrompt && next && (
        <div className="next-prompt">
          <button type="button" className="btn btn--gray" onClick={() => setCreditsDismissed(true)}>Abspann ansehen</button>
          <button type="button" className="btn btn--white" onClick={playNext}>
            <IconNext width={18} height={18} /> Nächste Folge
          </button>
        </div>
      )}

      {ended && next && !settings.autoplayNext && (
        <div className="post-play">
          <h2>Als Nächstes</h2>
          <button type="button" className="post-play__card" onClick={playNext}>
            <EpisodeArt item={next} />
            <span>{episodeCode(next)} {next.Name}</span>
          </button>
          <button type="button" className="btn btn--gray" onClick={goBack}>Zurück</button>
        </div>
      )}

      {locked ? (
        <button type="button" className="unlock-btn" onClick={() => setLocked(false)} style={{ opacity: controlsVisible ? 1 : 0 }}>
          <IconLock width={20} height={20} /> Entsperren
        </button>
      ) : (
        <>
          <div className="player__top">
            <button type="button" className="ctl" aria-label="Zurück" onClick={goBack}>
              <IconBack />
            </button>
            {!canHover && <div className="player__top-title">{titleLine}</div>}
          </div>

          {!canHover && !errorMessage && (
            <div className="player__touch-center">
              <button type="button" className="ctl" aria-label="10 Sekunden zurück" onClick={() => seekBy(-SEEK_STEP)}>
                <IconSkip direction="back" width={44} height={44} />
              </button>
              <button type="button" className="ctl ctl--main" aria-label={paused ? 'Abspielen' : 'Pause'} onClick={togglePlay}>
                {paused ? <IconPlay width={56} height={56} /> : <IconPause width={56} height={56} />}
              </button>
              <button type="button" className="ctl" aria-label="10 Sekunden vor" onClick={() => seekBy(SEEK_STEP)}>
                <IconSkip direction="forward" width={44} height={44} />
              </button>
            </div>
          )}

          <div className="player__bottom">
            {panel && (
              <div className="player__panel" role="dialog" aria-label="Wiedergabeoptionen">
                {panel === 'tracks' && (
                  <TrackPanel
                    audio={playback.audioStreams}
                    subtitles={playback.subtitleStreams}
                    audioIndex={playback.audioIndex}
                    subtitleIndex={playback.subtitleIndex}
                    onAudio={(i) => {
                      playback.selectAudio(i);
                      setPanel(null);
                    }}
                    onSubtitle={(i) => {
                      playback.selectSubtitle(i);
                      setPanel(null);
                    }}
                  />
                )}
                {panel === 'speed' && (
                  <div className="speed-panel">
                    <h3>Wiedergabegeschwindigkeit</h3>
                    <div className="speed-panel__line">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={rate === s}
                          className={rate === s ? 'is-active' : ''}
                          onClick={() => {
                            if (videoRef.current) videoRef.current.playbackRate = s;
                            setRate(s);
                            setPanel(null);
                          }}
                        >
                          <i />
                          {s === 1 ? '1x (Normal)' : `${String(s).replace('.', ',')}x`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {panel === 'episodes' && item && <EpisodePanel current={item} />}
              </div>
            )}

            <Scrubber
              time={time}
              duration={totalDuration}
              buffered={buffered}
              trickplay={trickplay}
              onSeek={seekTo}
              onScrubChange={setScrubbing}
            />

            {canHover ? (
              <div className="player__buttons">
                <button type="button" className="ctl" aria-label={paused ? 'Abspielen' : 'Pause'} onClick={togglePlay}>
                  {paused ? <IconPlay /> : <IconPause />}
                </button>
                <button type="button" className="ctl" aria-label="10 Sekunden zurück" onClick={() => seekBy(-SEEK_STEP)}>
                  <IconSkip direction="back" />
                </button>
                <button type="button" className="ctl" aria-label="10 Sekunden vor" onClick={() => seekBy(SEEK_STEP)}>
                  <IconSkip direction="forward" />
                </button>
                <VolumeControl video={videoRef} volume={settings.volume} muted={settings.muted} onToggle={toggleMute} />
                <div className="player__title">{titleLine}</div>
                {next && (
                  <button type="button" className="ctl" aria-label="Nächste Folge" title="Nächste Folge" onClick={playNext}>
                    <IconNext />
                  </button>
                )}
                {isEpisode && (
                  <button type="button" className="ctl" aria-label="Folgen" title="Folgen" aria-expanded={panel === 'episodes'} onClick={() => setPanel(panel === 'episodes' ? null : 'episodes')}>
                    <IconEpisodes />
                  </button>
                )}
                <button type="button" className="ctl" aria-label="Audio und Untertitel" title="Audio und Untertitel" aria-expanded={panel === 'tracks'} onClick={() => setPanel(panel === 'tracks' ? null : 'tracks')}>
                  <IconSubtitles />
                </button>
                <button type="button" className="ctl" aria-label="Wiedergabegeschwindigkeit" title="Wiedergabegeschwindigkeit" aria-expanded={panel === 'speed'} onClick={() => setPanel(panel === 'speed' ? null : 'speed')}>
                  <IconSpeed />
                </button>
                <button type="button" className="ctl" aria-label={isFullscreen ? 'Vollbild beenden' : 'Vollbild'} onClick={() => void toggleFullscreen()}>
                  {isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
                </button>
              </div>
            ) : (
              <div className="player__touch-buttons">
                <button type="button" onClick={() => setPanel(panel === 'speed' ? null : 'speed')}>
                  <IconSpeed width={20} height={20} /> Tempo ({String(rate).replace('.', ',')}x)
                </button>
                <button type="button" onClick={() => setLocked(true)}>
                  <IconLock width={20} height={20} /> Sperren
                </button>
                {isEpisode && (
                  <button type="button" onClick={() => setPanel(panel === 'episodes' ? null : 'episodes')}>
                    <IconEpisodes width={20} height={20} /> Folgen
                  </button>
                )}
                <button type="button" onClick={() => setPanel(panel === 'tracks' ? null : 'tracks')}>
                  <IconSubtitles width={20} height={20} /> Audio und Untertitel
                </button>
                {next && (
                  <button type="button" onClick={playNext}>
                    <IconNext width={20} height={20} /> Nächste Folge
                  </button>
                )}
                <button type="button" aria-label={isFullscreen ? 'Vollbild beenden' : 'Vollbild'} onClick={() => void toggleFullscreen()}>
                  {isFullscreen ? <IconFullscreenExit width={20} height={20} /> : <IconFullscreen width={20} height={20} />}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EpisodeArt({ item }: { item: Item }) {
  const client = useClient();
  const art = landscapeImage(client.serverUrl, item, 480);
  return art ? <img src={art} alt="" /> : null;
}

function VolumeControl({ video, volume, muted, onToggle }: { video: React.RefObject<HTMLVideoElement | null>; volume: number; muted: boolean; onToggle: () => void }) {
  const level = muted ? 0 : volume;
  return (
    <div className="volume">
      <button type="button" className="ctl" aria-label={muted ? 'Ton an' : 'Ton aus'} onClick={onToggle}>
        {level === 0 ? <IconMuted /> : level < 0.5 ? <IconVolumeLow /> : <IconVolume />}
      </button>
      <div className="volume__pop">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={level}
          aria-label="Lautstärke"
          style={{ '--level': `${level * 100}%` } as React.CSSProperties}
          onChange={(e) => {
            const el = video.current;
            if (!el) return;
            el.volume = Number(e.target.value);
            el.muted = Number(e.target.value) === 0;
          }}
        />
      </div>
    </div>
  );
}

function TrackPanel({
  audio,
  subtitles,
  audioIndex,
  subtitleIndex,
  onAudio,
  onSubtitle,
}: {
  audio: MediaStream[];
  subtitles: MediaStream[];
  audioIndex: number | null;
  subtitleIndex: number;
  onAudio: (index: number) => void;
  onSubtitle: (index: number) => void;
}) {
  return (
    <div className="track-panel">
      <div>
        <h3>Audio</h3>
        <ul>
          {audio.map((s) => (
            <li key={s.Index}>
              <button type="button" aria-pressed={s.Index === audioIndex} className={s.Index === audioIndex ? 'is-active' : ''} onClick={() => onAudio(s.Index)}>
                {s.Index === audioIndex && <IconCheck width={16} height={16} />} {trackLabel(s)}
              </button>
            </li>
          ))}
          {audio.length === 0 && <li className="track-panel__none">Keine Audiospuren</li>}
        </ul>
      </div>
      <div>
        <h3>Untertitel</h3>
        <ul>
          <li>
            <button type="button" aria-pressed={subtitleIndex === SUBTITLES_OFF} className={subtitleIndex === SUBTITLES_OFF ? 'is-active' : ''} onClick={() => onSubtitle(SUBTITLES_OFF)}>
              {subtitleIndex === SUBTITLES_OFF && <IconCheck width={16} height={16} />} Aus
            </button>
          </li>
          {subtitles.map((s) => (
            <li key={s.Index}>
              <button type="button" aria-pressed={s.Index === subtitleIndex} className={s.Index === subtitleIndex ? 'is-active' : ''} onClick={() => onSubtitle(s.Index)}>
                {s.Index === subtitleIndex && <IconCheck width={16} height={16} />} {trackLabel(s)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EpisodePanel({ current }: { current: Item }) {
  const client = useClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['episodes', current.SeriesId, current.SeasonId],
    enabled: Boolean(current.SeriesId && current.SeasonId),
    queryFn: async () => (await client.episodes(current.SeriesId!, { seasonId: current.SeasonId! })).Items,
  });
  return (
    <div className="episode-panel">
      <h3>{current.SeasonName ?? 'Folgen'}</h3>
      <ol>
        {data?.map((ep) => (
          <li key={ep.Id} className={ep.Id === current.Id ? 'is-current' : ''}>
            <button type="button" onClick={() => navigate(`/watch/${ep.Id}`, { replace: true })}>
              <span className="episode-panel__num">{ep.IndexNumber}</span>
              <EpisodeArt item={ep} />
              <span className="episode-panel__text">
                <strong>{ep.Name}</strong>
                <small>{formatRuntime(ep.RunTimeTicks)}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
