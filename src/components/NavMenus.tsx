import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LIST_FIELDS } from '../api/client';
import { landscapeImage } from '../api/images';
import type { Item } from '../api/types';
import { useDetailLink } from '../lib/actions';
import { episodeCode } from '../lib/format';
import { useCanHover } from '../lib/hooks';
import { useClient, useSession } from '../state/session';
import { APP_NAME, Avatar } from './Brand';
import { IconAccount, IconBell, IconCaret, IconClose, IconHelp, IconPencil, IconSearch } from './Icons';

const OPEN_DELAY = 100;
const CLOSE_DELAY = 300;

/**
 * Navbar dropdown behaviour: with a mouse the panel follows the pointer and a click on the
 * trigger keeps it open; touch and keyboard toggle it. Esc, an outside press, tabbing away
 * and a route change close it.
 */
function useNavMenu(onOpen?: () => void) {
  const canHover = useCanHover();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const { pathname, search } = useLocation();

  const schedule = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), delay);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!open) return;
    onOpenRef.current?.();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return {
    open,
    close: () => setOpen(false),
    rootProps: {
      ref: root,
      onMouseEnter: canHover ? () => schedule(true, OPEN_DELAY) : undefined,
      onMouseLeave: canHover ? () => schedule(false, CLOSE_DELAY) : undefined,
      onBlur: (e: React.FocusEvent) => {
        const next = e.relatedTarget as Node | null;
        if (next && !root.current?.contains(next)) setOpen(false);
      },
    },
    triggerProps: {
      ref: trigger,
      'aria-expanded': open,
      onClick: (e: React.MouseEvent) => {
        window.clearTimeout(timer.current);
        // detail is 0 for keyboard activation, which must still be able to close the panel.
        if (canHover && e.detail > 0) setOpen(true);
        else setOpen((o) => !o);
      },
    },
  };
}

// --- Suche -------------------------------------------------------------------------------------

export function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearchPage = location.pathname === '/search';
  const query = onSearchPage ? (params.get('q') ?? '') : '';
  const [text, setText] = useState(query);
  const [open, setOpen] = useState(onSearchPage);
  const input = useRef<HTMLInputElement>(null);
  const returnTo = useRef('/browse');

  useEffect(() => {
    // While typing, the input is the source of truth: a lagging URL must not overwrite newer keystrokes.
    if (document.activeElement !== input.current) setText(query);
  }, [query]);

  useEffect(() => {
    if (onSearchPage) setOpen(true);
    else if (document.activeElement !== input.current) setOpen(false);
  }, [onSearchPage]);

  const update = (value: string) => {
    setText(value);
    if (!onSearchPage) returnTo.current = location.pathname + location.search;
    if (value) navigate(`/search?q=${encodeURIComponent(value)}`, { replace: onSearchPage });
    else if (onSearchPage) navigate(returnTo.current);
  };

  return (
    <div
      className={`search${open ? ' is-open' : ''}`}
      onBlur={(e) => {
        const inside = e.currentTarget.contains(e.relatedTarget as Node | null);
        if (!inside && !text) setOpen(false);
      }}
    >
      <button
        type="button"
        className="icon-btn search__toggle"
        aria-label="Suchen"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          input.current?.focus();
        }}
      >
        <IconSearch />
      </button>
      <input
        ref={input}
        type="search"
        value={text}
        tabIndex={open ? 0 : -1}
        placeholder="Titel, Personen, Genres"
        aria-label="Titel, Personen, Genres suchen"
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            update('');
            setOpen(false);
            input.current?.blur();
          }
        }}
      />
      {text && (
        <button
          type="button"
          className="icon-btn search__clear"
          aria-label="Suche löschen"
          // Keeps focus in the field, so the box stays open for the next search.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            update('');
            input.current?.focus();
          }}
        >
          <IconClose width={18} height={18} />
        </button>
      )}
    </div>
  );
}

// --- Benachrichtigungen ------------------------------------------------------------------------

const SEEN_KEY = 'jf.notifications.seen';

/** Jellyfin has no per-user inbox for this: recently added titles stand in for "new arrivals". */
export function useNotifications() {
  const client = useClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await client.items({ includeItemTypes: ['Movie', 'Episode'], sortBy: 'DateCreated', sortOrder: 'Descending', limit: 12, fields: [...LIST_FIELDS, 'DateCreated'] })).Items,
  });
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY) ?? '');
  const newest = data?.[0]?.DateCreated ?? '';
  const unread = data?.filter((i) => (i.DateCreated ?? '') > seen).length ?? 0;
  const markSeen = useCallback(() => {
    if (!newest) return;
    localStorage.setItem(SEEN_KEY, newest);
    setSeen(newest);
  }, [newest]);
  return { items: data, isLoading, unread, markSeen };
}

function relativeDate(iso?: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Heute';
  if (days === 1) return 'Gestern';
  if (days < 7) return `Vor ${days} Tagen`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Vor 1 Woche' : `Vor ${weeks} Wochen`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'Vor 1 Monat' : `Vor ${months} Monaten`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'Vor 1 Jahr' : `Vor ${years} Jahren`;
}

export function NotificationEntry({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const client = useClient();
  const art = landscapeImage(client.serverUrl, item, 240);
  const isEpisode = item.Type === 'Episode';
  return (
    <button type="button" className="notification" onClick={onOpen}>
      {art ? <img src={art} alt="" loading="lazy" /> : <span className="notification__blank" />}
      <span className="notification__text">
        <span>{isEpisode ? 'Neue Folge' : 'Neu hinzugefügt'}</span>
        <strong>{isEpisode ? item.SeriesName : item.Name}</strong>
        {isEpisode && <span>{episodeCode(item)} „{item.Name}“</span>}
        <small>{relativeDate(item.DateCreated)}</small>
      </span>
    </button>
  );
}

export function NotificationsMenu() {
  const detail = useDetailLink();
  const { items, unread, markSeen } = useNotifications();
  const menu = useNavMenu(markSeen);
  return (
    <div className={`nav-menu-wrap notifications${menu.open ? ' is-open' : ''}`} {...menu.rootProps}>
      <button type="button" className="icon-btn" aria-label={`Benachrichtigungen${unread ? `, ${unread} neu` : ''}`} {...menu.triggerProps}>
        <IconBell />
        {unread > 0 && <span className="notifications__badge">{unread}</span>}
      </button>
      <div className="nav-menu notifications__panel">
        <span className="nav-menu__arrow" aria-hidden="true" />
        {items?.length ? (
          <ul className="notifications__list">
            {items.map((item) => (
              <li key={item.Id}>
                <NotificationEntry
                  item={item}
                  onOpen={() => {
                    menu.close();
                    detail.open(item);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="nav-menu__empty">Keine aktuellen Benachrichtigungen</p>
        )}
      </div>
    </div>
  );
}

// --- Profil ------------------------------------------------------------------------------------

export function ProfileMenu() {
  const { active, accounts, serverName, switchTo, signOut } = useSession();
  const navigate = useNavigate();
  const menu = useNavMenu();
  if (!active) return null;
  const others = accounts.filter((a) => a.userId !== active.userId);
  const go = (action: () => void) => {
    menu.close();
    action();
  };
  return (
    <div className={`nav-menu-wrap profile-menu${menu.open ? ' is-open' : ''}`} {...menu.rootProps}>
      <button type="button" className="profile-menu__button" aria-label="Konto und Profile" {...menu.triggerProps}>
        <Avatar userId={active.userId} name={active.name} tag={active.imageTag} />
        <IconCaret className="nav-caret" width={14} height={14} />
      </button>
      <div className="nav-menu profile-menu__panel">
        <span className="nav-menu__arrow" aria-hidden="true" />
        <div className="profile-menu__current">
          <Avatar userId={active.userId} name={active.name} tag={active.imageTag} size={40} />
          <span>
            <strong>{active.name}</strong>
            <small>{serverName ?? APP_NAME}</small>
          </span>
        </div>
        <ul>
          {others.map((a) => (
            <li key={a.userId}>
              <button
                type="button"
                className="profile-menu__item"
                onClick={() =>
                  go(() => {
                    switchTo(a.userId);
                    navigate('/browse');
                  })
                }
              >
                <Avatar userId={a.userId} name={a.name} tag={a.imageTag} />
                <span>{a.name}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="profile-menu__item"
              onClick={() =>
                go(() => navigate('/profiles', { state: { manage: true } }))
              }
            >
              <IconPencil width={20} height={20} />
              <span>Profile verwalten</span>
            </button>
          </li>
          <li>
            <button type="button" className="profile-menu__item" onClick={() => go(() => navigate('/account'))}>
              <IconAccount width={20} height={20} />
              <span>Konto</span>
            </button>
          </li>
          <li>
            <a className="profile-menu__item" href="https://jellyfin.org/docs/" target="_blank" rel="noreferrer noopener" onClick={menu.close}>
              <IconHelp width={20} height={20} />
              <span>Hilfe</span>
            </a>
          </li>
        </ul>
        <button type="button" className="profile-menu__signout" onClick={() => go(() => signOut(active.userId))}>
          Von {APP_NAME} abmelden
        </button>
      </div>
    </div>
  );
}

// --- Kompakte Navigation -----------------------------------------------------------------------

export function CompactNav({ links }: { links: { to: string; label: string; end?: boolean }[] }) {
  const menu = useNavMenu();
  return (
    <div className={`nav-menu-wrap compact-nav${menu.open ? ' is-open' : ''}`} {...menu.rootProps}>
      <button type="button" className="compact-nav__button" {...menu.triggerProps}>
        Menü <IconCaret className="nav-caret" width={16} height={16} />
      </button>
      <div className="nav-menu compact-nav__panel">
        <span className="nav-menu__arrow" aria-hidden="true" />
        <ul>
          {links.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end}>{n.label}</NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
