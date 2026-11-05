import { useSyncExternalStore } from 'react';

/** Per-device playback preferences. */
export interface Settings {
  autoplayNext: boolean;
  autoplayPreviews: boolean;
  /** Maximum streaming bitrate in bits/s. */
  maxBitrate: number;
  volume: number;
  muted: boolean;
  previewsMuted: boolean;
}

export const QUALITY_OPTIONS: { label: string; hint: string; value: number }[] = [
  { label: 'Automatisch', hint: 'Beste verfügbare Qualität', value: 120_000_000 },
  { label: 'Hoch', hint: '1080p · 20 Mbit/s', value: 20_000_000 },
  { label: 'Mittel', hint: '720p · 8 Mbit/s', value: 8_000_000 },
  { label: 'Niedrig', hint: '480p · 3 Mbit/s', value: 3_000_000 },
  { label: 'Datensparer', hint: '360p · 1,5 Mbit/s', value: 1_500_000 },
];

const KEY = 'jf.settings.v1';
const defaults: Settings = {
  autoplayNext: true,
  autoplayPreviews: true,
  maxBitrate: QUALITY_OPTIONS[0].value,
  volume: 1,
  muted: false,
  previewsMuted: true,
};

let current: Settings = (() => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return defaults;
  }
})();

const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
