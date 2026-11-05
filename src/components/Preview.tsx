import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item } from '../api/types';
import { useClient } from '../state/session';
import { useSettings } from '../state/settings';

/**
 * Finds a short clip to preview an item: a local trailer first, then a theme video.
 * Remote (YouTube) trailers are not embedded; they are offered as links in the detail view.
 */
export function usePreviewUrl(item: Item | null, enabled: boolean): string | null {
  const client = useClient();
  const { autoplayPreviews } = useSettings();
  const { data } = useQuery({
    queryKey: ['preview', item?.Id],
    enabled: Boolean(item) && enabled && autoplayPreviews,
    staleTime: Infinity,
    queryFn: async () => {
      const id = item!.Id;
      let clipId: string | undefined;
      if (item!.LocalTrailerCount) clipId = (await client.localTrailers(id))[0]?.Id;
      if (!clipId) {
        const theme = await client.themeMedia(id).catch(() => null);
        clipId = theme?.ThemeVideosResult?.Items?.[0]?.Id;
      }
      return clipId ? client.authedUrl(`/Videos/${clipId}/stream`, { static: true, mediaSourceId: clipId }) : null;
    },
  });
  return data ?? null;
}

interface PreviewVideoProps {
  src: string | null;
  muted: boolean;
  /** Delay before starting, so the artwork is seen first. */
  delayMs?: number;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
  replayKey?: number;
}

/** Muted background video; stays invisible (artwork shows through) until frames actually play. */
export function PreviewVideo({ src, muted, delayMs = 0, onPlayingChange, onEnded, replayKey }: PreviewVideoProps) {
  const [ready, setReady] = useState(delayMs === 0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (delayMs === 0) return;
    const id = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  useEffect(() => {
    setVisible(false);
    onPlayingChange?.(false);
    // Only a new clip or an explicit replay resets playback state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, replayKey]);

  if (!src || !ready) return null;
  return (
    <video
      key={`${src}#${replayKey ?? 0}`}
      className={`preview-video${visible ? ' is-visible' : ''}`}
      src={src}
      muted={muted}
      autoPlay
      playsInline
      preload="auto"
      onPlaying={() => {
        setVisible(true);
        onPlayingChange?.(true);
      }}
      onEnded={() => {
        setVisible(false);
        onPlayingChange?.(false);
        onEnded?.();
      }}
      onError={() => {
        setVisible(false);
        onPlayingChange?.(false);
      }}
    />
  );
}
