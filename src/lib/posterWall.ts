import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { JellyfinClient } from '../api/client';
import { posterImage } from '../api/images';

const KEY = 'jf.wall.v1';
const WALL_SIZE = 72;

export function forgetPosterWall() {
  localStorage.removeItem(KEY);
}

/** Poster URLs seen on this device for this server. Jellyfin serves images without authentication. */
export function readPosterWall(serverUrl: string | null): string[] {
  if (!serverUrl) return [];
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { serverUrl: string; urls: string[] } | null;
    return saved?.serverUrl === serverUrl ? saved.urls : [];
  } catch {
    return [];
  }
}

/** Remembers a few posters while signed in, so the sign-in screen can show the library behind the form. */
export function useCapturePosterWall(client: JellyfinClient) {
  const { data } = useQuery({
    queryKey: ['poster-wall'],
    staleTime: Infinity,
    queryFn: async () =>
      (await client.items({ includeItemTypes: ['Movie', 'Series'], sortBy: 'Random', limit: WALL_SIZE, imageTypes: 'Primary', fields: [] })).Items,
  });
  useEffect(() => {
    if (!data?.length) return;
    const urls = data.map((item) => posterImage(client.serverUrl, item, 260)).filter((u): u is string => Boolean(u));
    localStorage.setItem(KEY, JSON.stringify({ serverUrl: client.serverUrl, urls }));
  }, [data, client.serverUrl]);
}
