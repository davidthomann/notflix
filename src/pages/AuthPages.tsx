import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, normalizeServerUrl } from '../api/client';
import { Art } from '../components/Art';
import { Avatar, Logo } from '../components/Brand';
import { IconPlus } from '../components/Icons';
import { readPosterWall } from '../lib/posterWall';
import { useSession } from '../state/session';

const DEFAULT_SERVER: string = import.meta.env.VITE_JELLYFIN_SERVER ?? '';

/** Enough tiles to cover the rotated wall, repeating the posters of small libraries. */
const WALL_TILES = 84;

function AuthShell({ children }: { children: React.ReactNode }) {
  const { serverUrl } = useSession();
  const [posters] = useState(() => readPosterWall(serverUrl));
  return (
    <div className="auth">
      <div className="auth__backdrop" aria-hidden="true">
        {posters.length > 0 && (
          <div className="auth__wall">
            {Array.from({ length: WALL_TILES }, (_, i) => (
              <Art key={i} src={posters[i % posters.length]} />
            ))}
          </div>
        )}
      </div>
      <header className="auth__header">
        <Logo />
      </header>
      <main className="auth__card">{children}</main>
    </div>
  );
}

export function ConnectPage() {
  const { anonymousClient, setServer, serverUrl } = useSession();
  const navigate = useNavigate();
  const [url, setUrl] = useState(serverUrl ?? DEFAULT_SERVER);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeServerUrl(url);
    if (!normalized) {
      setError('Bitte gib die Adresse deines Jellyfin-Servers ein.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const info = await anonymousClient(normalized).publicInfo(AbortSignal.timeout(10_000));
      if (!info?.Id) throw new ApiError(0, 'no id');
      setServer(normalized, info.ServerName);
      navigate('/profiles');
    } catch {
      const blocked = window.location.protocol === 'https:' && normalized.startsWith('http://');
      setError(
        blocked
          ? 'Diese Seite läuft über HTTPS und darf keinen HTTP-Server erreichen. Verwende eine HTTPS-Adresse.'
          : 'Unter dieser Adresse wurde kein Jellyfin-Server gefunden. Prüfe Adresse, Port und die CORS-Einstellungen.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1>Mit Server verbinden</h1>
      <form onSubmit={submit} noValidate>
        {error && <p className="auth__error" role="alert">{error}</p>}
        <label className="field">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder=" "
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          <span>Serveradresse</span>
        </label>
        <button type="submit" className="btn btn--red btn--block" disabled={busy}>
          {busy ? 'Verbinden …' : 'Verbinden'}
        </button>
      </form>
      <p className="auth__note">Zum Beispiel http://192.168.1.10:8096 oder https://jellyfin.example.org</p>
    </AuthShell>
  );
}

export function LoginPage() {
  const { serverUrl, serverName, anonymousClient, addAccount } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState(params.get('user') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState<{ code: string; secret: string } | null>(null);

  const client = serverUrl ? anonymousClient(serverUrl) : null;

  const { data: quickEnabled } = useQuery({
    queryKey: ['quickconnect', serverUrl],
    enabled: Boolean(client),
    retry: false,
    queryFn: () => client!.quickConnectEnabled(),
  });

  // Poll until the code has been approved in another signed-in client.
  useEffect(() => {
    if (!quick || !client) return;
    let stopped = false;
    const id = window.setInterval(async () => {
      try {
        const status = await client.quickConnectStatus(quick.secret);
        if (status.Authenticated && !stopped) {
          window.clearInterval(id);
          addAccount(await client.quickConnectLogin(quick.secret));
          navigate('/browse', { replace: true });
        }
      } catch {
        if (!stopped) {
          window.clearInterval(id);
          setQuick(null);
          setError('Der Anmeldecode ist abgelaufen. Bitte fordere einen neuen an.');
        }
      }
    }, 3000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, serverUrl]);

  if (!serverUrl || !client) return <Navigate to="/connect" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Bitte gib deinen Benutzernamen ein.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      addAccount(await client.login(username.trim(), password));
      navigate('/browse', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Benutzername oder Passwort ist falsch.'
          : 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.',
      );
    } finally {
      setBusy(false);
    }
  };

  const startQuickConnect = async () => {
    setError('');
    try {
      const r = await client.quickConnectInitiate();
      setQuick({ code: r.Code, secret: r.Secret });
    } catch {
      setError('Anmeldecodes sind auf diesem Server nicht verfügbar.');
    }
  };

  if (quick) {
    return (
      <AuthShell>
        <h1>Anmeldecode</h1>
        <p className="auth__note auth__note--lg">
          Öffne Jellyfin auf einem angemeldeten Gerät, gehe zu „Quick Connect“ und gib diesen Code ein:
        </p>
        <output className="auth__code" aria-live="polite">{quick.code}</output>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setQuick(null)}>
          Zurück zur Anmeldung
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1>Anmelden</h1>
      <form onSubmit={submit} noValidate>
        {error && <p className="auth__error" role="alert">{error}</p>}
        <label className="field">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder=" "
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={!username}
          />
          <span>Benutzername</span>
        </label>
        <label className="field">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder=" "
            autoComplete="current-password"
            autoFocus={Boolean(username)}
          />
          <span>Passwort</span>
          {password && (
            <button type="button" className="field__toggle" onClick={() => setShowPassword((s) => !s)}>
              {showPassword ? 'Verbergen' : 'Anzeigen'}
            </button>
          )}
        </label>
        <button type="submit" className="btn btn--red btn--block" disabled={busy}>
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
      {quickEnabled && (
        <>
          <div className="auth__or">ODER</div>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => void startQuickConnect()}>
            Anmeldecode verwenden
          </button>
        </>
      )}
      <p className="auth__server">
        Server: <strong>{serverName ?? serverUrl}</strong> · <Link to="/connect">Ändern</Link>
      </p>
    </AuthShell>
  );
}

export function ProfilesPage() {
  const { serverUrl, serverName, accounts, active, switchTo, signOut, anonymousClient, forgetServer } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [manageMode, setManageMode] = useState(() => Boolean((location.state as { manage?: boolean } | null)?.manage));
  // Signing out the last profile leaves nothing to manage.
  const managing = manageMode && accounts.length > 0;

  const { data: publicUsers } = useQuery({
    queryKey: ['publicUsers', serverUrl],
    enabled: Boolean(serverUrl),
    retry: false,
    queryFn: () => anonymousClient(serverUrl!).publicUsers(),
  });

  if (!serverUrl) return <Navigate to="/connect" replace />;
  // Managing keeps the session alive, so the back button returns to the app.
  if (active && !managing) return <Navigate to="/browse" replace />;

  // Without any known user there is nothing to choose from: go straight to the sign-in form.
  if (publicUsers && publicUsers.length === 0 && accounts.length === 0) {
    return <Navigate to="/login" replace />;
  }

  const savedIds = new Set(accounts.map((a) => a.userId));
  const others = (publicUsers ?? []).filter((u) => !savedIds.has(u.Id));

  return (
    <div className="profiles">
      <header className="auth__header">
        <Logo />
      </header>
      <main className="profiles__center">
        <h1>{managing ? 'Profile verwalten:' : 'Wer schaut gerade?'}</h1>
        <ul className="profiles__list">
          {accounts.map((a) => (
            <li key={a.userId}>
              <button
                type="button"
                className={`profile${managing ? ' is-managing' : ''}`}
                onClick={() => {
                  if (managing) signOut(a.userId);
                  else {
                    switchTo(a.userId);
                    navigate('/browse');
                  }
                }}
                aria-label={managing ? `${a.name} auf diesem Gerät abmelden` : a.name}
              >
                <span className="profile__art">
                  <Avatar userId={a.userId} name={a.name} tag={a.imageTag} size={160} />
                  {managing && <span className="profile__overlay">Abmelden</span>}
                </span>
                <span className="profile__name">{a.name}</span>
              </button>
            </li>
          ))}
          {!managing &&
            others.map((u) => (
              <li key={u.Id}>
                <button type="button" className="profile" onClick={() => navigate(`/login?user=${encodeURIComponent(u.Name)}`)}>
                  <span className="profile__art">
                    <Avatar userId={u.Id} name={u.Name} tag={u.PrimaryImageTag} size={160} />
                  </span>
                  <span className="profile__name">{u.Name}</span>
                </button>
              </li>
            ))}
          {!managing && (
            <li>
              <button type="button" className="profile profile--add" onClick={() => navigate('/login')}>
                <span className="profile__art">
                  <IconPlus width={72} height={72} />
                </span>
                <span className="profile__name">Profil hinzufügen</span>
              </button>
            </li>
          )}
        </ul>
        <div className="profiles__actions">
          {accounts.length > 0 && (
            <button type="button" className="btn-outline" onClick={() => {
                if (managing) switchTo(null);
                setManageMode(!managing);
              }}>
              {managing ? 'Fertig' : 'Profile verwalten'}
            </button>
          )}
          {!managing && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                forgetServer();
                navigate('/connect');
              }}
            >
              Server wechseln
            </button>
          )}
        </div>
        <p className="profiles__server">{serverName ?? serverUrl}</p>
      </main>
    </div>
  );
}
