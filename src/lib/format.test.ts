import { describe, expect, it } from 'vitest';
import { episodeCode, formatClock, formatRuntime, freshBadge, progressPercent, seededShuffle } from './format';
import { buildDeviceProfile } from '../api/deviceProfile';
import { authHeader, buildQuery, normalizeServerUrl } from '../api/client';
import type { Item } from '../api/types';

const item = (o: Partial<Item>): Item => ({ Id: '1', Name: 'x', Type: 'Movie', ...o });

describe('format', () => {
  it('formats runtimes in German', () => {
    expect(formatRuntime(0)).toBe('');
    expect(formatRuntime(25 * 60 * 1e7)).toBe('25 Min.');
    expect(formatRuntime(120 * 60 * 1e7)).toBe('2 Std.');
    expect(formatRuntime(102 * 60 * 1e7)).toBe('1 Std. 42 Min.');
  });
  it('formats clock values', () => {
    expect(formatClock(69)).toBe('1:09');
    expect(formatClock(3729)).toBe('1:02:09');
    expect(formatClock(NaN)).toBe('0:00');
  });
  it('computes progress from either field', () => {
    expect(progressPercent(item({ UserData: { PlayedPercentage: 40 } }))).toBe(40);
    expect(progressPercent(item({ RunTimeTicks: 100, UserData: { PlaybackPositionTicks: 25 } }))).toBe(25);
    expect(progressPercent(item({}))).toBe(0);
  });
  it('builds episode codes', () => {
    expect(episodeCode(item({ Type: 'Episode', ParentIndexNumber: 2, IndexNumber: 5 }))).toBe('S2:F5');
    expect(episodeCode(item({}))).toBe('');
  });
  it('labels recently added titles', () => {
    const now = Date.parse('2026-11-05T12:00:00Z');
    expect(freshBadge(item({ DateCreated: '2026-11-01T00:00:00Z' }), now)).toBe('Neu hinzugefügt');
    expect(freshBadge(item({ DateCreated: '2026-01-01T00:00:00Z' }), now)).toBeNull();
    expect(freshBadge(item({ Type: 'Series', DateCreated: '2026-01-01T00:00:00Z', DateLastMediaAdded: '2026-11-04T00:00:00Z' }), now)).toBe('Neue Folgen');
    expect(freshBadge(item({ DateLastMediaAdded: '2026-11-04T00:00:00Z' }), now)).toBeNull();
  });
  it('shuffles stably without losing elements', () => {
    const list = [1, 2, 3, 4, 5, 6];
    expect(seededShuffle(list, 7)).toEqual(seededShuffle(list, 7));
    expect([...seededShuffle(list, 7)].sort()).toEqual(list);
  });
});

describe('client helpers', () => {
  it('normalizes server URLs', () => {
    expect(normalizeServerUrl('demo.local:8096/')).toBe('http://demo.local:8096');
    expect(normalizeServerUrl('https://a.b/jf/web/index.html')).toBe('https://a.b/jf');
    expect(normalizeServerUrl('https://a.b/stable')).toBe('https://a.b/stable');
  });
  it('builds queries, joining arrays and skipping empties', () => {
    expect(buildQuery({ a: 1, b: ['x', 'y'], c: undefined, d: '', e: false })).toBe('?a=1&b=x%2Cy&e=false');
    expect(buildQuery({})).toBe('');
  });
  it('builds the MediaBrowser header and strips quote characters', () => {
    expect(authHeader('id', 'My "Phone"', 'tok')).toBe(
      'MediaBrowser Client="jellyfin-frontend", Device="My  Phone ", DeviceId="id", Version="0.1.0", Token="tok"',
    );
  });
});

describe('device profile', () => {
  it('offers only what the browser supports', () => {
    const profile = buildDeviceProfile(8_000_000, (m) => m.includes('avc1') || m.includes('mp4a'));
    expect(profile.MaxStreamingBitrate).toBe(8_000_000);
    expect(profile.DirectPlayProfiles[0]).toMatchObject({ VideoCodec: 'h264', AudioCodec: 'aac' });
    expect(profile.TranscodingProfiles[0]).toMatchObject({ Protocol: 'hls', VideoCodec: 'h264', AudioCodec: 'aac' });
    expect(profile.SubtitleProfiles).toContainEqual({ Format: 'pgssub', Method: 'Encode' });
  });
  it('adds HEVC to stream-copy targets when decodable', () => {
    const profile = buildDeviceProfile(1, (m) => m.includes('avc1') || m.includes('hvc1') || m.includes('mp4a'));
    expect(profile.TranscodingProfiles[0].VideoCodec).toBe('h264,hevc');
  });
});
