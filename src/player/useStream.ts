import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Hls from 'hls.js';
import { useQueryClient } from '@tanstack/react-query';
import { buildDeviceProfile } from '../api/deviceProfile';
import type { JellyfinClient } from '../api/client';
import type { Item, MediaSource, MediaStream, PlaybackReport, PlayMethod } from '../api/types';
import { secondsToTicks } from '../lib/format';
import { getSettings } from '../state/settings';

export const SUBTITLES_OFF = -1;
const PROGRESS_INTERVAL_MS = 10_000;

interface Stream {
  url: string;
  isHls: boolean;
  method: PlayMethod;
  source: MediaSource;
  playSessionId: string | null;
  /** Subtitle index rendered into the video by the server, if any. */
  burnedSubtitle: number | null;
}

interface LoadOptions {
  audio?: number;
  subtitle?: number;
  forceTranscode?: boolean;
}

const streamsOf = (source: MediaSource | undefined, type: MediaStream['Type']) =>
  source?.MediaStreams?.filter((s) => s.Type === type) ?? [];

/**
 * Negotiates playback with the server, attaches the result to the video element and keeps
 * the server informed about progress (resume points, "played" state, dashboard sessions).
 */
export function useStream(video: RefObject<HTMLVideoElement | null>, client: JellyfinClient, item: Item | undefined, startSeconds: number | null) {
  const qc = useQueryClient();
  const [stream, setStream] = useState<Stream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioIndex, setAudioIndex] = useState<number | null>(null);
  const [subtitleIndex, setSubtitleIndex] = useState<number>(SUBTITLES_OFF);
  const [needsGesture, setNeedsGesture] = useState(false);

  const itemId = item?.Id;
  const pendingStart = useRef<number>(0);
  const loadToken = useRef(0);
  const triedTranscode = useRef(false);
  const lastPosition = useRef(0);
  // Current selections, read by the reporter without re-creating it.
  const selection = useRef({ audio: null as number | null, subtitle: SUBTITLES_OFF });
  selection.current = { audio: audioIndex, subtitle: subtitleIndex };

  const load = useCallback(
    async (options: LoadOptions = {}): Promise<void> => {
      if (!itemId) return;
      const token = ++loadToken.current;
      setError(null);
      const { maxBitrate } = getSettings();
      const force = Boolean(options.forceTranscode);
      try {
        const info = await client.playbackInfo(itemId, {
          DeviceProfile: buildDeviceProfile(maxBitrate),
          MaxStreamingBitrate: maxBitrate,
          AudioStreamIndex: options.audio,
          SubtitleStreamIndex: options.subtitle,
          EnableDirectPlay: !force,
          EnableDirectStream: !force,
          EnableTranscoding: true,
          AllowVideoStreamCopy: true,
          AllowAudioStreamCopy: true,
          AutoOpenLiveStream: true,
        });
        if (token !== loadToken.current) return;
        if (info.ErrorCode) throw new Error(info.ErrorCode);
        const source = info.MediaSources?.[0];
        if (!source) throw new Error('NoCompatibleStream');

        const audioStreams = streamsOf(source, 'Audio');
        const defaultAudio = options.audio ?? source.DefaultAudioStreamIndex ?? audioStreams[0]?.Index ?? null;
        const defaultSubtitle = options.subtitle ?? source.DefaultSubtitleStreamIndex ?? SUBTITLES_OFF;
        const subtitleStream = streamsOf(source, 'Subtitle').find((s) => s.Index === defaultSubtitle);

        // Image subtitles must be requested explicitly so the server burns them in.
        if (options.subtitle === undefined && subtitleStream?.DeliveryMethod === 'Encode') {
          return load({ ...options, subtitle: subtitleStream.Index });
        }

        const needsBurnIn = subtitleStream?.DeliveryMethod === 'Encode';
        // A burned-in subtitle only exists in a transcode, whatever the source would otherwise allow.
        if (!force && needsBurnIn && !source.TranscodingUrl) {
          return load({ ...options, subtitle: subtitleStream!.Index, forceTranscode: true });
        }
        const canDirect = !force && !needsBurnIn && Boolean(source.SupportsDirectPlay);
        // Browsers always play a file's first audio track; any other track needs a remux by the server.
        const wantsOtherAudio = defaultAudio !== null && audioStreams.length > 1 && defaultAudio !== audioStreams[0].Index;
        if (canDirect && wantsOtherAudio) {
          return load({ ...options, audio: defaultAudio, forceTranscode: true });
        }

        let next: Stream;
        const burned = needsBurnIn ? subtitleStream!.Index : null;
        if (canDirect) {
          next = {
            url: client.authedUrl(`/Videos/${itemId}/stream`, {
              static: true,
              mediaSourceId: source.Id,
              playSessionId: info.PlaySessionId,
              deviceId: client.deviceId,
              tag: source.ETag,
            }),
            isHls: false,
            method: 'DirectPlay',
            source,
            playSessionId: info.PlaySessionId ?? null,
            burnedSubtitle: null,
          };
        } else if (source.TranscodingUrl) {
          next = {
            url: client.resolve(source.TranscodingUrl),
            isHls: source.TranscodingSubProtocol === 'hls' || source.TranscodingUrl.includes('.m3u8'),
            method: 'Transcode',
            source,
            playSessionId: info.PlaySessionId ?? null,
            burnedSubtitle: burned,
          };
        } else {
          throw new Error('NoCompatibleStream');
        }

        setAudioIndex(defaultAudio);
        setSubtitleIndex(defaultSubtitle);
        setStream(next);
      } catch (err) {
        if (token !== loadToken.current) return;
        const code = (err as Error).message;
        setError(
          code === 'NotAllowed'
            ? 'Dein Konto darf diesen Titel nicht abspielen.'
            : code === 'NoCompatibleStream'
              ? 'Für dieses Gerät steht kein passender Videostream zur Verfügung.'
              : 'Der Stream konnte nicht geladen werden.',
        );
      }
    },
    [client, itemId],
  );

  // First load once the item and its resume point are known.
  useEffect(() => {
    if (!itemId || startSeconds === null) return;
    pendingStart.current = startSeconds;
    lastPosition.current = startSeconds;
    triedTranscode.current = false;
    void load();
    return () => {
      loadToken.current++;
    };
  }, [itemId, startSeconds, load]);

  const reload = useCallback(
    (options: LoadOptions) => {
      // While a stream is still loading, currentTime reads 0: keep the last known position instead.
      const el = video.current;
      pendingStart.current = el && el.readyState >= 1 && el.currentTime > 0 ? el.currentTime : lastPosition.current;
      return load(options);
    },
    [load, video],
  );

  /** The viewer's track choices, or nothing before the first load so the server's defaults apply. */
  const hasStream = stream !== null;
  const currentTracks = useCallback(
    (): LoadOptions =>
      hasStream ? { audio: selection.current.audio ?? undefined, subtitle: selection.current.subtitle } : {},
    [hasStream],
  );

  // --- Progress reporting. Declared before the attach effect so its cleanup reads the position first.
  useEffect(() => {
    const el = video.current;
    if (!el || !stream || !itemId) return;
    let started = false;
    let stopped = false;

    const report = (): PlaybackReport => ({
      ItemId: itemId,
      MediaSourceId: stream.source.Id,
      PlaySessionId: stream.playSessionId,
      PositionTicks: secondsToTicks(lastPosition.current),
      IsPaused: el.paused,
      IsMuted: el.muted,
      VolumeLevel: Math.round(el.volume * 100),
      AudioStreamIndex: selection.current.audio,
      SubtitleStreamIndex: selection.current.subtitle,
      PlayMethod: stream.method,
      CanSeek: true,
    });

    const onTime = () => {
      if (el.currentTime > 0) lastPosition.current = el.currentTime;
    };
    const onPlaying = () => {
      if (started) return;
      started = true;
      client.reportStart(report()).catch(() => undefined);
    };
    const onPauseChange = (event: Event) => {
      if (started) client.reportProgress({ ...report(), EventName: event.type === 'pause' ? 'Pause' : 'Unpause' }).catch(() => undefined);
    };
    const onSeeked = () => {
      if (started) client.reportProgress({ ...report(), EventName: 'TimeUpdate' }).catch(() => undefined);
    };
    const stop = () => {
      if (!started || stopped) return;
      stopped = true;
      client
        .reportStopped(report())
        .catch(() => undefined)
        .finally(() => {
          for (const key of ['resume', 'nextup', 'episodes', 'item', 'player-item', 'rewatch', 'history']) {
            void qc.invalidateQueries({ queryKey: [key] });
          }
        });
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPauseChange);
    el.addEventListener('play', onPauseChange);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('ended', stop);
    window.addEventListener('pagehide', stop);
    const interval = window.setInterval(() => {
      if (started && !stopped && !el.paused) client.reportProgress({ ...report(), EventName: 'TimeUpdate' }).catch(() => undefined);
    }, PROGRESS_INTERVAL_MS);

    return () => {
      stop();
      window.clearInterval(interval);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPauseChange);
      el.removeEventListener('play', onPauseChange);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('ended', stop);
      window.removeEventListener('pagehide', stop);
    };
  }, [stream, itemId, client, qc, video]);

  // --- Attach to the video element.
  useEffect(() => {
    const el = video.current;
    if (!el || !stream) return;
    const start = pendingStart.current;
    let hls: Hls | null = null;
    let networkRetries = 0;
    setNeedsGesture(false);

    const startPlayback = () => {
      el.play().catch((err: Error) => {
        // Autoplay policies reject without a user gesture; the UI then offers a play button.
        if (err.name === 'NotAllowedError') setNeedsGesture(true);
      });
    };

    const fail = () => {
      if (!triedTranscode.current && stream.method === 'DirectPlay') {
        // The browser could not decode the file after all: ask the server for a transcode.
        triedTranscode.current = true;
        void reload({ ...currentTracks(), forceTranscode: true });
        return;
      }
      setError('Bei der Wiedergabe ist ein Fehler aufgetreten.');
    };

    const nativeHls = Boolean(el.canPlayType('application/vnd.apple.mpegurl'));
    const preferNative = nativeHls && /iP(hone|ad|od)/.test(navigator.userAgent);

    if (stream.isHls && Hls.isSupported() && !preferNative) {
      hls = new Hls({ startPosition: start > 0 ? start : -1, maxBufferLength: 30, backBufferLength: 60 });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || !hls) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 3) {
          networkRetries++;
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && networkRetries < 3) {
          networkRetries++;
          hls.recoverMediaError();
        } else {
          fail();
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.loadSource(stream.url);
      hls.attachMedia(el);
    } else {
      el.src = stream.url;
      const onMetadata = () => {
        if (start > 0) el.currentTime = start;
        startPlayback();
      };
      el.addEventListener('loadedmetadata', onMetadata, { once: true });
      el.load();
    }

    const onError = () => {
      if (!hls) fail();
    };
    el.addEventListener('error', onError);

    return () => {
      el.removeEventListener('error', onError);
      hls?.destroy();
      el.removeAttribute('src');
      el.load();
    };
  }, [stream, video, reload, currentTracks]);

  const selectAudio = useCallback(
    (index: number) => {
      if (index === selection.current.audio) return;
      const first = streamsOf(stream?.source, 'Audio')[0]?.Index;
      void reload({ ...currentTracks(), audio: index, forceTranscode: index !== first });
    },
    [reload, stream, currentTracks],
  );

  const selectSubtitle = useCallback(
    (index: number) => {
      const target = streamsOf(stream?.source, 'Subtitle').find((s) => s.Index === index);
      const needsBurnIn = target?.DeliveryMethod === 'Encode';
      if (needsBurnIn || stream?.burnedSubtitle != null) {
        void reload({ ...currentTracks(), subtitle: index });
      } else {
        setSubtitleIndex(index);
      }
    },
    [reload, stream, currentTracks],
  );

  const activeSubtitle = streamsOf(stream?.source, 'Subtitle').find((s) => s.Index === subtitleIndex);
  const subtitleUrl =
    activeSubtitle?.DeliveryMethod === 'External' && activeSubtitle.DeliveryUrl
      ? client.resolve(activeSubtitle.DeliveryUrl)
      : null;

  const retry = useCallback(() => {
    triedTranscode.current = false;
    void reload(currentTracks());
  }, [reload, currentTracks]);

  return {
    stream,
    error,
    needsGesture,
    clearGesture: () => setNeedsGesture(false),
    audioIndex,
    subtitleIndex,
    audioStreams: streamsOf(stream?.source, 'Audio'),
    subtitleStreams: streamsOf(stream?.source, 'Subtitle'),
    subtitleUrl,
    selectAudio,
    selectSubtitle,
    retry,
  };
}
