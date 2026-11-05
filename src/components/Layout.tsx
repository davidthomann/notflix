import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile, useMediaQuery } from '../lib/hooks';
import { useCapturePosterWall } from '../lib/posterWall';
import { useClient, useSession } from '../state/session';
import { Avatar, Logo } from './Brand';
import { DetailModalHost } from './DetailModal';
import { HoverProvider } from './HoverCard';
import { IconChevronDown, IconClose, IconFlame, IconHome, IconMenu, IconSearch } from './Icons';
import { CompactNav, NotificationsMenu, ProfileMenu, SearchBox } from './NavMenus';

const NAV = [
  { to: '/browse', label: 'Startseite', end: true },
  { to: '/browse/series', label: 'Serien' },
  { to: '/browse/movies', label: 'Filme' },
  { to: '/browse/latest', label: 'Neu und beliebt' },
  { to: '/browse/my-list', label: 'Meine Liste' },
  { to: '/browse/languages', label: 'Nach Sprachen durchsuchen' },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const compact = useMediaQuery('(max-width: 1100px)');
  const isSmall = useMediaQuery('(max-width: 1280px)');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`navbar${scrolled ? ' is-scrolled' : ''}`}>
      <Link to="/browse" aria-label="Startseite"><Logo /></Link>
      {compact ? (
        <CompactNav links={NAV} />
      ) : (
        <nav aria-label="Hauptnavigation">
          <ul className="navbar__links">
            {NAV.filter((n) => !(isSmall && n.to === '/browse/languages')).map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.end}>{n.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="navbar__right">
        <SearchBox />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}

function MobileTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const path = location.pathname;
  const isHomeLike = path === '/browse' || path === '/browse/series' || path === '/browse/movies';
  return (
    <header className={`mobile-top${scrolled ? ' is-scrolled' : ''}`}>
      <div className="mobile-top__bar">
        {path === '/me' ? <h1 className="mobile-top__title">Mein Profil</h1> : <Link to="/browse" aria-label="Startseite"><Logo /></Link>}
        <div className="mobile-top__actions">
          <button type="button" className="icon-btn" aria-label="Suchen" onClick={() => navigate('/search')}>
            <IconSearch />
          </button>
          {path === '/me' && (
            <button type="button" className="icon-btn" aria-label="Konto und Einstellungen" onClick={() => navigate('/account')}>
              <IconMenu />
            </button>
          )}
        </div>
      </div>
      {isHomeLike && (
        <nav className="chips" aria-label="Kategorien">
          {path !== '/browse' && (
            <Link to="/browse" className="chip chip--close" aria-label="Filter entfernen">
              <IconClose width={14} height={14} />
            </Link>
          )}
          {path !== '/browse/movies' && <NavLink to="/browse/series" className="chip">Serien</NavLink>}
          {path !== '/browse/series' && <NavLink to="/browse/movies" className="chip">Filme</NavLink>}
          <Link to="/browse/categories" className="chip">
            Kategorien <IconChevronDown width={12} height={12} />
          </Link>
        </nav>
      )}
    </header>
  );
}

function MobileTabBar() {
  const { active } = useSession();
  const { pathname } = useLocation();
  const onLatest = pathname.startsWith('/browse/latest');
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <NavLink to="/browse" className={({ isActive }) => (isActive && !onLatest ? 'is-active' : '')}>
        <IconHome />
        <span>Startseite</span>
      </NavLink>
      <NavLink to="/browse/latest" className={({ isActive }) => (isActive ? 'is-active' : '')}>
        <IconFlame />
        <span>Neu und beliebt</span>
      </NavLink>
      <NavLink to="/me" className={({ isActive }) => (isActive ? 'is-active' : '')}>
        {active && <Avatar userId={active.userId} name={active.name} tag={active.imageTag} size={24} />}
        <span>Mein Profil</span>
      </NavLink>
    </nav>
  );
}

function Footer() {
  const { serverName } = useSession();
  return (
    <footer className="footer">
      <ul>
        <li><Link to="/account">Konto</Link></li>
        <li><Link to="/browse/my-list">Meine Liste</Link></li>
        <li><Link to="/browse/languages">Sprachen</Link></li>
        <li><a href="https://jellyfin.org/docs/" target="_blank" rel="noreferrer noopener">Jellyfin-Dokumentation</a></li>
      </ul>
      <small>{serverName ? `Verbunden mit ${serverName}` : ''}</small>
    </footer>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const isMobile = useIsMobile();
  useCapturePosterWall(useClient());
  return (
    <HoverProvider>
      <div className="app">
        {isMobile ? <MobileTopBar /> : <Navbar />}
        <main className="app__main">{children ?? <Outlet />}</main>
        {!isMobile && <Footer />}
        {isMobile && <MobileTabBar />}
      </div>
      <DetailModalHost />
    </HoverProvider>
  );
}
