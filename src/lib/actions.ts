import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';
import type { JellyfinClient } from '../api/client';
import type { Item, UserData } from '../api/types';
import { useClient } from '../state/session';

/** Rewrites one item's user data wherever it sits in cached lists, so every card updates at once. */
function patchUserData(qc: QueryClient, id: string, patch: Partial<UserData>) {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((entry) => {
        const out = walk(entry);
        if (out !== entry) changed = true;
        return out;
      });
      return changed ? next : value;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (obj.Id === id && 'Type' in obj) {
        return { ...obj, UserData: { ...(obj.UserData as object | undefined), ...patch } };
      }
      for (const key of ['Items', 'pages'] as const) {
        if (key in obj) {
          const inner = walk(obj[key]);
          if (inner !== obj[key]) return { ...obj, [key]: inner };
        }
      }
    }
    return value;
  };
  qc.setQueriesData({}, walk);
}

export function useItemActions(item: Item) {
  const client = useClient();
  const qc = useQueryClient();
  const data = item.UserData;

  const favorite = useMutation({
    mutationFn: (next: boolean) => client.setFavorite(item.Id, next),
    onMutate: (next) => patchUserData(qc, item.Id, { IsFavorite: next }),
    onError: () => patchUserData(qc, item.Id, { IsFavorite: data?.IsFavorite }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['mylist'] }),
  });

  const rate = useMutation({
    mutationFn: (next: boolean | null) => client.setLikes(item.Id, next),
    onMutate: (next) => patchUserData(qc, item.Id, { Likes: next }),
    onError: () => patchUserData(qc, item.Id, { Likes: data?.Likes }),
  });

  const played = useMutation({
    mutationFn: (next: boolean) => client.setPlayed(item.Id, next),
    onMutate: (next) => patchUserData(qc, item.Id, { Played: next, PlaybackPositionTicks: 0, PlayedPercentage: 0 }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['resume'] });
      qc.invalidateQueries({ queryKey: ['nextup'] });
      qc.invalidateQueries({ queryKey: ['episodes'] });
    },
  });

  const removeFromRow = useMutation({
    mutationFn: () => client.clearProgress(item.Id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['resume'] }),
  });

  return { favorite, rate, played, removeFromRow };
}

/** Finds what "play" means for an item: series and collections start at a concrete episode or film. */
export async function resolvePlayable(client: JellyfinClient, item: Item): Promise<Item | null> {
  switch (item.Type) {
    case 'Series': {
      const next = await client.nextUp({ seriesId: item.Id, limit: 1 });
      if (next.Items[0]) return next.Items[0];
      const first = await client.episodes(item.Id, { limit: 1 });
      return first.Items[0] ?? null;
    }
    case 'Season': {
      const first = await client.episodes(item.SeriesId ?? '', { seasonId: item.Id, limit: 1 });
      return first.Items[0] ?? null;
    }
    case 'BoxSet': {
      const first = await client.items({ parentId: item.Id, recursive: false, limit: 1, sortBy: 'ProductionYear,SortName' });
      return first.Items[0] ?? null;
    }
    default:
      return item;
  }
}

export function usePlay() {
  const client = useClient();
  const navigate = useNavigate();
  return useCallback(
    async (item: Item, options?: { fromStart?: boolean }) => {
      const target = await resolvePlayable(client, item);
      if (target) navigate(`/watch/${target.Id}${options?.fromStart ? '?t=0' : ''}`);
    },
    [client, navigate],
  );
}

/** Id shown in the detail view for an item: episodes and seasons open their series. */
export function detailId(item: Pick<Item, 'Id' | 'Type' | 'SeriesId'>): string {
  return (item.Type === 'Episode' || item.Type === 'Season') && item.SeriesId ? item.SeriesId : item.Id;
}

/** Detail view lives in the URL (`?jbv=<id>`), so it is linkable and the back button closes it. */
export function useDetailLink() {
  const location = useLocation();
  const navigate = useNavigate();

  const hrefFor = useCallback(
    (item: Pick<Item, 'Id' | 'Type' | 'SeriesId'>) => {
      const params = new URLSearchParams(location.search);
      params.set('jbv', detailId(item));
      return `${location.pathname}?${params}`;
    },
    [location.pathname, location.search],
  );

  const stateFor = useCallback((): NavigateOptions => {
    const depth = (location.state as { detailDepth?: number } | null)?.detailDepth ?? 0;
    return { state: { detailDepth: depth + 1 }, preventScrollReset: true };
  }, [location.state]);

  const open = useCallback(
    (item: Pick<Item, 'Id' | 'Type' | 'SeriesId'>) => navigate(hrefFor(item), stateFor()),
    [navigate, hrefFor, stateFor],
  );

  const close = useCallback(() => {
    const depth = (location.state as { detailDepth?: number } | null)?.detailDepth ?? 0;
    if (depth > 0) {
      navigate(-depth);
      return;
    }
    const params = new URLSearchParams(location.search);
    params.delete('jbv');
    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true, preventScrollReset: true });
  }, [location, navigate]);

  return { open, close, hrefFor, stateFor };
}
