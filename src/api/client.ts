import type {
  AuthResult,
  Item,
  ItemsResult,
  MediaSegment,
  PlaybackInfoResponse,
  PlaybackReport,
  PublicSystemInfo,
  QuickConnectResult,
  RecommendationDto,
  SearchHint,
  UserData,
  UserDto,
} from './types';

export const CLIENT_NAME = 'jellyfin-frontend';
export const CLIENT_VERSION = '0.1.0';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fields the browse UI needs on every list item. */
export const LIST_FIELDS = [
  'Overview',
  'Genres',
  'PrimaryImageAspectRatio',
  'LocalTrailerCount',
  'IsHD',
  'ChildCount',
  'RecursiveItemCount',
  'DateCreated',
  'DateLastMediaAdded',
];

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export function normalizeServerUrl(input: string): string {
  let url = input.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '').replace(/\/web(\/.*)?$/i, '');
}

export function buildQuery(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function authHeader(deviceId: string, deviceName: string, token?: string): string {
  const q = (s: string) => s.replace(/["\\\r\n]/g, ' ');
  const parts = [
    `Client="${q(CLIENT_NAME)}"`,
    `Device="${q(deviceName)}"`,
    `DeviceId="${q(deviceId)}"`,
    `Version="${CLIENT_VERSION}"`,
  ];
  if (token) parts.push(`Token="${q(token)}"`);
  return `MediaBrowser ${parts.join(', ')}`;
}

export interface ClientOptions {
  serverUrl: string;
  deviceId: string;
  deviceName: string;
  token?: string;
  userId?: string;
  /** Invoked when an authenticated request is rejected (expired/revoked token). */
  onUnauthorized?: () => void;
}

export class JellyfinClient {
  constructor(readonly opts: ClientOptions) {}

  get serverUrl() {
    return this.opts.serverUrl;
  }
  get userId() {
    return this.opts.userId ?? '';
  }
  get token() {
    return this.opts.token ?? '';
  }
  get deviceId() {
    return this.opts.deviceId;
  }

  /** Server-relative URL (TranscodingUrl, DeliveryUrl, ...) to absolute. */
  resolve(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.serverUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  url(path: string, query?: Query): string {
    return `${this.serverUrl}${path}${buildQuery(query)}`;
  }

  /** URL for browser-loaded media (video/track/img), which cannot send an Authorization header. */
  authedUrl(path: string, query?: Query): string {
    return this.url(path, { ...query, ApiKey: this.token });
  }

  async request<T>(
    path: string,
    init: { method?: string; query?: Query; body?: unknown; keepalive?: boolean; signal?: AbortSignal } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: authHeader(this.opts.deviceId, this.opts.deviceName, this.opts.token),
      Accept: 'application/json',
    };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetch(this.url(path, init.query), {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        keepalive: init.keepalive,
        signal: init.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      throw new ApiError(0, 'Der Server ist nicht erreichbar.');
    }
    if (res.status === 401 && this.opts.token) this.opts.onUnauthorized?.();
    if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => '')) || res.statusText);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // --- System & authentication -------------------------------------------------------------

  publicInfo = (signal?: AbortSignal) => this.request<PublicSystemInfo>('/System/Info/Public', { signal });
  publicUsers = () => this.request<UserDto[]>('/Users/Public');
  login = (username: string, password: string) =>
    this.request<AuthResult>('/Users/AuthenticateByName', {
      method: 'POST',
      body: { Username: username, Pw: password },
    });
  logout = () => this.request<void>('/Sessions/Logout', { method: 'POST', keepalive: true });
  me = () => this.request<UserDto>('/Users/Me');
  quickConnectEnabled = () => this.request<boolean>('/QuickConnect/Enabled');
  quickConnectInitiate = () => this.request<QuickConnectResult>('/QuickConnect/Initiate', { method: 'POST' });
  quickConnectStatus = (secret: string) =>
    this.request<QuickConnectResult>('/QuickConnect/Connect', { query: { secret } });
  quickConnectLogin = (secret: string) =>
    this.request<AuthResult>('/Users/AuthenticateWithQuickConnect', { method: 'POST', body: { Secret: secret } });
  reportCapabilities = () =>
    this.request<void>('/Sessions/Capabilities/Full', {
      method: 'POST',
      body: {
        PlayableMediaTypes: ['Video'],
        SupportedCommands: [],
        SupportsMediaControl: false,
        SupportsPersistentIdentifier: true,
      },
    });

  // --- Library ------------------------------------------------------------------------------

  views = () => this.request<ItemsResult>('/UserViews', { query: { userId: this.userId } });

  items = (query: Query, signal?: AbortSignal) =>
    this.request<ItemsResult>('/Items', {
      query: {
        userId: this.userId,
        recursive: true,
        fields: LIST_FIELDS,
        enableUserData: true,
        imageTypeLimit: 1,
        enableImageTypes: ['Primary', 'Backdrop', 'Thumb', 'Logo'],
        ...query,
      },
      signal,
    });

  /** `/Items/{id}` takes no `fields` parameter: it always returns the full DTO. */
  item = (id: string) => this.request<Item>(`/Items/${id}`, { query: { userId: this.userId } });

  /** Item with Trickplay metadata. `/Items/{id}` has no `fields`, so ask the list endpoint. */
  playerItem = async (id: string): Promise<Item> => {
    const res = await this.request<ItemsResult>('/Items', {
      query: {
        userId: this.userId,
        ids: id,
        fields: ['Trickplay', 'Overview', 'MediaSources', 'MediaStreams'],
        enableUserData: true,
      },
    });
    if (res.Items[0]) return res.Items[0];
    return this.item(id);
  };

  latest = (query: Query) =>
    this.request<Item[]>('/Items/Latest', {
      query: {
        userId: this.userId,
        fields: LIST_FIELDS,
        enableUserData: true,
        imageTypeLimit: 1,
        enableImageTypes: ['Primary', 'Backdrop', 'Thumb', 'Logo'],
        limit: 24,
        ...query,
      },
    });

  resume = (limit = 24) =>
    this.request<ItemsResult>('/UserItems/Resume', {
      query: {
        userId: this.userId,
        limit,
        mediaTypes: 'Video',
        fields: LIST_FIELDS,
        enableUserData: true,
        imageTypeLimit: 1,
        enableImageTypes: ['Primary', 'Backdrop', 'Thumb', 'Logo'],
      },
    });

  nextUp = (query: Query = {}) =>
    this.request<ItemsResult>('/Shows/NextUp', {
      query: {
        userId: this.userId,
        limit: 24,
        fields: LIST_FIELDS,
        enableUserData: true,
        imageTypeLimit: 1,
        enableImageTypes: ['Primary', 'Backdrop', 'Thumb', 'Logo'],
        ...query,
      },
    });

  upcoming = (limit = 30) =>
    this.request<ItemsResult>('/Shows/Upcoming', {
      query: { userId: this.userId, limit, fields: LIST_FIELDS, imageTypeLimit: 1 },
    });

  seasons = (seriesId: string) =>
    this.request<ItemsResult>(`/Shows/${seriesId}/Seasons`, {
      query: { userId: this.userId, enableUserData: true },
    });

  episodes = (seriesId: string, query: Query = {}) =>
    this.request<ItemsResult>(`/Shows/${seriesId}/Episodes`, {
      query: {
        userId: this.userId,
        fields: ['Overview', 'PrimaryImageAspectRatio'],
        enableUserData: true,
        ...query,
      },
    });

  similar = (id: string, limit = 12) =>
    this.request<ItemsResult>(`/Items/${id}/Similar`, {
      query: { userId: this.userId, limit, fields: LIST_FIELDS },
    });

  recommendations = (query: Query = {}) =>
    this.request<RecommendationDto[]>('/Movies/Recommendations', {
      query: { userId: this.userId, categoryLimit: 4, itemLimit: 20, fields: LIST_FIELDS, ...query },
    });

  genres = (query: Query = {}) =>
    this.request<ItemsResult>('/Genres', {
      query: { userId: this.userId, sortBy: 'SortName', sortOrder: 'Ascending', ...query },
    });

  localTrailers = (id: string) =>
    this.request<Item[]>(`/Items/${id}/LocalTrailers`, { query: { userId: this.userId } });

  themeMedia = (id: string) =>
    this.request<{ ThemeVideosResult?: ItemsResult }>(`/Items/${id}/ThemeMedia`, {
      query: { userId: this.userId, inheritFromParent: true },
    });

  searchHints = (searchTerm: string, limit = 40) =>
    this.request<{ SearchHints: SearchHint[]; TotalRecordCount: number }>('/Search/Hints', {
      query: {
        userId: this.userId,
        searchTerm,
        limit,
        includeItemTypes: ['Movie', 'Series', 'BoxSet', 'Video', 'Person', 'Genre'],
        includePeople: true,
        includeGenres: true,
        includeMedia: true,
        includeStudios: false,
        includeArtists: false,
      },
    });

  // --- User data ----------------------------------------------------------------------------

  setFavorite = (id: string, favorite: boolean) =>
    this.request<UserData>(`/UserFavoriteItems/${id}`, {
      method: favorite ? 'POST' : 'DELETE',
      query: { userId: this.userId },
    });

  setPlayed = (id: string, played: boolean) =>
    this.request<UserData>(`/UserPlayedItems/${id}`, {
      method: played ? 'POST' : 'DELETE',
      query: { userId: this.userId },
    });

  /** Removes an item from "Weiterschauen" without marking it as watched. */
  clearProgress = (id: string) =>
    this.request<UserData>(`/UserItems/${id}/UserData`, {
      method: 'POST',
      query: { userId: this.userId },
      body: { PlaybackPositionTicks: 0 },
    });

  /** `likes: null` clears the rating. */
  setLikes = (id: string, likes: boolean | null) =>
    this.request<UserData>(`/UserItems/${id}/UserData`, {
      method: 'POST',
      query: { userId: this.userId },
      body: { Likes: likes },
    });

  // --- Playback -----------------------------------------------------------------------------

  playbackInfo = (id: string, body: Record<string, unknown>) =>
    this.request<PlaybackInfoResponse>(`/Items/${id}/PlaybackInfo`, {
      method: 'POST',
      query: { userId: this.userId },
      body: { UserId: this.userId, ...body },
    });

  mediaSegments = async (id: string): Promise<MediaSegment[]> => {
    try {
      const res = await this.request<{ Items: MediaSegment[] }>(`/MediaSegments/${id}`);
      return res.Items ?? [];
    } catch {
      return []; // Endpoint absent on older servers; segments are an optional extra.
    }
  };

  reportStart = (r: PlaybackReport) => this.request<void>('/Sessions/Playing', { method: 'POST', body: r });
  reportProgress = (r: PlaybackReport) =>
    this.request<void>('/Sessions/Playing/Progress', { method: 'POST', body: r });
  reportStopped = (r: PlaybackReport) =>
    this.request<void>('/Sessions/Playing/Stopped', { method: 'POST', body: r, keepalive: true });
}
