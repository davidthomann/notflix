import type { Item } from '../api/types';

export const TICKS_PER_SECOND = 10_000_000;
export const ticksToSeconds = (ticks: number) => ticks / TICKS_PER_SECOND;
export const secondsToTicks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);

/** "1 Std. 42 Min." */
export function formatRuntime(ticks?: number | null): string {
  if (!ticks) return '';
  const minutes = Math.round(ticks / TICKS_PER_SECOND / 60);
  if (minutes < 1) return '< 1 Min.';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

/** "1:02:09" or "42:09" */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function progressPercent(item: Item): number {
  const data = item.UserData;
  if (!data) return 0;
  if (data.PlayedPercentage) return Math.min(100, data.PlayedPercentage);
  if (data.PlaybackPositionTicks && item.RunTimeTicks) {
    return Math.min(100, (data.PlaybackPositionTicks / item.RunTimeTicks) * 100);
  }
  return 0;
}

/** "Noch 23 Min." label for partially watched items. */
export function remainingLabel(item: Item): string {
  const pos = item.UserData?.PlaybackPositionTicks ?? 0;
  if (!pos || !item.RunTimeTicks) return '';
  return `Noch ${formatRuntime(item.RunTimeTicks - pos)}`;
}

export function episodeCode(item: Item): string {
  if (item.Type !== 'Episode') return '';
  const s = item.ParentIndexNumber;
  const e = item.IndexNumber;
  if (s == null && e == null) return '';
  return `S${s ?? '?'}:F${e ?? '?'}`;
}

export function seasonLabel(item: Item): string {
  const n = item.ChildCount;
  if (!n) return '';
  return n === 1 ? '1 Staffel' : `${n} Staffeln`;
}

/** Display title; episodes in shared rows read as "Serie — S1:F2". */
export function displayTitle(item: Item): string {
  return item.Type === 'Episode' && item.SeriesName ? item.SeriesName : item.Name;
}

export function yearRange(item: Item): string {
  if (!item.ProductionYear) return '';
  if (item.Type !== 'Series') return String(item.ProductionYear);
  const end = item.EndDate ? new Date(item.EndDate).getFullYear() : null;
  if (item.Status === 'Ended' && end && end !== item.ProductionYear) return `${item.ProductionYear}–${end}`;
  return String(item.ProductionYear);
}

/** Community rating (0–10) expressed as a percentage for the green score label. */
export function scorePercent(item: Item): number | null {
  if (item.CommunityRating) return Math.round(item.CommunityRating * 10);
  if (item.CriticRating) return Math.round(item.CriticRating);
  return null;
}

const FRESH_DAYS = 14;

/** Small card label for titles that arrived on the server recently. */
export function freshBadge(item: Item, now = Date.now()): string | null {
  const isFresh = (iso?: string | null) => Boolean(iso) && now - new Date(iso!).getTime() < FRESH_DAYS * 86_400_000;
  if (isFresh(item.DateCreated)) return 'Neu hinzugefügt';
  if (item.Type === 'Series' && isFresh(item.DateLastMediaAdded)) return 'Neue Folgen';
  return null;
}

/** Stable pseudo-random shuffle so a page keeps its order across re-renders. */
export function seededShuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
