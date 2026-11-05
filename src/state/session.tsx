import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { JellyfinClient } from '../api/client';
import type { AuthResult } from '../api/types';
import { forgetPosterWall } from '../lib/posterWall';

/** A signed-in Jellyfin user; shown as a profile on the "Wer schaut gerade?" screen. */
export interface Account {
  userId: string;
  name: string;
  imageTag?: string | null;
  token: string;
  serverId: string;
}

interface Persisted {
  serverUrl: string | null;
  serverName: string | null;
  accounts: Account[];
  activeUserId: string | null;
}

const STORAGE_KEY = 'jf.session.v1';
const DEVICE_KEY = 'jf.deviceId';

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} (${os})` : browser;
}

function load(): Persisted {
  const empty: Persisted = { serverUrl: null, serverName: null, accounts: [], activeUserId: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

interface SessionContextValue {
  serverUrl: string | null;
  serverName: string | null;
  accounts: Account[];
  active: Account | null;
  /** Client for the active account, or an anonymous client if only the server is known. */
  client: JellyfinClient | null;
  anonymousClient: (serverUrl: string) => JellyfinClient;
  setServer: (url: string, name?: string | null) => void;
  forgetServer: () => void;
  addAccount: (auth: AuthResult) => void;
  switchTo: (userId: string | null) => void;
  /** Ends this user's session on the server and removes the local profile. */
  signOut: (userId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);
  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const anonymousClient = useCallback(
    (serverUrl: string) => new JellyfinClient({ serverUrl, deviceId: deviceId(), deviceName: deviceName() }),
    [],
  );

  const active = useMemo(
    () => state.accounts.find((a) => a.userId === state.activeUserId) ?? null,
    [state.accounts, state.activeUserId],
  );

  const activeToken = active?.token;
  const activeId = active?.userId;
  const client = useMemo(() => {
    if (!state.serverUrl || !activeToken || !activeId) return null;
    return new JellyfinClient({
      serverUrl: state.serverUrl,
      deviceId: deviceId(),
      deviceName: deviceName(),
      token: activeToken,
      userId: activeId,
      onUnauthorized: () =>
        setState((s) => ({
          ...s,
          accounts: s.accounts.filter((a) => a.userId !== activeId),
          activeUserId: s.activeUserId === activeId ? null : s.activeUserId,
        })),
    });
  }, [state.serverUrl, activeToken, activeId]);

  useEffect(() => {
    client?.reportCapabilities().catch(() => undefined);
  }, [client]);

  const value = useMemo<SessionContextValue>(
    () => ({
      serverUrl: state.serverUrl,
      serverName: state.serverName,
      accounts: state.accounts,
      active,
      client,
      anonymousClient,
      setServer: (url, name) =>
        setState((s) =>
          s.serverUrl === url
            ? { ...s, serverName: name ?? s.serverName }
            : { serverUrl: url, serverName: name ?? null, accounts: [], activeUserId: null },
        ),
      forgetServer: () => {
        queryClient.clear();
        forgetPosterWall();
        setState({ serverUrl: null, serverName: null, accounts: [], activeUserId: null });
      },
      addAccount: (auth) => {
        queryClient.clear();
        const account: Account = {
          userId: auth.User.Id,
          name: auth.User.Name,
          imageTag: auth.User.PrimaryImageTag,
          token: auth.AccessToken,
          serverId: auth.ServerId,
        };
        setState((s) => ({
          ...s,
          accounts: [...s.accounts.filter((a) => a.userId !== account.userId), account],
          activeUserId: account.userId,
        }));
      },
      switchTo: (userId) => {
        queryClient.clear();
        setState((s) => ({ ...s, activeUserId: userId }));
      },
      signOut: (userId) => {
        const account = state.accounts.find((a) => a.userId === userId);
        if (account && state.serverUrl) {
          new JellyfinClient({
            serverUrl: state.serverUrl,
            deviceId: deviceId(),
            deviceName: deviceName(),
            token: account.token,
            userId,
          })
            .logout()
            .catch(() => undefined);
        }
        queryClient.clear();
        setState((s) => ({
          ...s,
          accounts: s.accounts.filter((a) => a.userId !== userId),
          activeUserId: s.activeUserId === userId ? null : s.activeUserId,
        }));
      },
    }),
    [state, active, client, anonymousClient, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

/** Client for screens that are only rendered while signed in. */
export function useClient(): JellyfinClient {
  const { client } = useSession();
  if (!client) throw new Error('useClient requires an active session');
  return client;
}
