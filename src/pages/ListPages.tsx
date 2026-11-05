import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { backdropImage, landscapeImage, logoImage } from '../api/images';
import type { Item } from '../api/types';
import { MyListButton } from '../components/ActionButtons';
import { Dropdown } from '../components/Dropdown';
import { InfiniteGrid, ItemGrid } from '../components/Grid';
import { IconBack, IconClose, IconInfo, IconPlay, IconSearch } from '../components/Icons';
import { LazyRow } from '../components/Row';
import { useDetailLink, usePlay } from '../lib/actions';
import { episodeCode } from '../lib/format';
import { useDebounced, useIsMobile } from '../lib/hooks';
import { useClient } from '../state/session';
import { TopTenRow, useVideoViews } from './BrowsePage';

function PageTitle({ children, back }: { children: React.ReactNode; back?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="page-title">
      {back && (
        <button type="button" className="icon-btn page-title__back" aria-label="Zurück" onClick={() => navigate(-1)}>
          <IconBack />
        </button>
      )}
      <h1>{children}</h1>
    </div>
  );
}

// --- Meine Liste -------------------------------------------------------------------------------

export function MyListPage() {
  const client = useClient();
  const { data, isLoading } = useQuery({
    queryKey: ['mylist', 'page'],
    queryFn: async () =>
      (await client.items({ isFavorite: true, includeItemTypes: ['Movie', 'Series', 'BoxSet', 'Video'], sortBy: 'DateCreated', sortOrder: 'Descending', limit: 200 })).Items,
  });
  return (
    <div className="page">
      <PageTitle>Meine Liste</PageTitle>
      {isLoading && <div className="center-spinner"><div className="spinner" /></div>}
      {data && data.length === 0 && (
        <p className="empty-note">Du hast noch keine Titel zu deiner Liste hinzugefügt.</p>
      )}
      {data && data.length > 0 && <ItemGrid items={data} />}
    </div>
  );
}

// --- Neu und beliebt ---------------------------------------------------------------------------

export function LatestPage() {
  const isMobile = useIsMobile();
  return isMobile ? <LatestMobile /> : <LatestDesktop />;
}

function LatestDesktop() {
  const client = useClient();
  const { data: views } = useVideoViews();
  return (
    <div className="page page--rows">
      <PageTitle>Neu und beliebt</PageTitle>
      <div className="rows">
        <LazyRow
          eager
          queryKey={['recently-added']}
          title="Neu auf deinem Server"
          fetch={async () => (await client.items({ includeItemTypes: ['Movie', 'Series'], sortBy: 'DateCreated', sortOrder: 'Descending', limit: 30 })).Items}
        />
        <TopTenRow type="Movie" title="Top 10 Filme" />
        <TopTenRow type="Series" title="Top 10 Serien" />
        <LazyRow
          queryKey={['upcoming']}
          title="Demnächst"
          fetch={async () => (await client.upcoming()).Items}
        />
        {views?.map((view) => (
          <LazyRow key={view.Id} queryKey={['latest', view.Id]} title={`Neu in ${view.Name}`} fetch={() => client.latest({ parentId: view.Id })} />
        ))}
      </div>
    </div>
  );
}

type FeedTab = 'new' | 'upcoming' | 'top';

function LatestMobile() {
  const client = useClient();
  const [tab, setTab] = useState<FeedTab>('new');
  const { data, isLoading } = useQuery({
    queryKey: ['feed', tab],
    queryFn: async () => {
      if (tab === 'upcoming') return (await client.upcoming(20)).Items;
      if (tab === 'top') {
        return (await client.items({ includeItemTypes: ['Movie', 'Series'], sortBy: 'CommunityRating,SortName', sortOrder: 'Descending', minCommunityRating: 0.1, limit: 10 })).Items;
      }
      return (await client.items({ includeItemTypes: ['Movie', 'Series'], sortBy: 'DateCreated', sortOrder: 'Descending', limit: 20 })).Items;
    },
  });
  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'new', label: 'Neu' },
    { key: 'upcoming', label: 'Demnächst' },
    { key: 'top', label: 'Top 10' },
  ];
  return (
    <div className="page feed">
      <h1 className="feed__title">Neu und beliebt</h1>
      <div className="chips chips--feed" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`chip${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {isLoading && <div className="center-spinner"><div className="spinner" /></div>}
      {data?.length === 0 && <p className="empty-note">Hier gibt es gerade nichts Neues.</p>}
      <ol className="feed__list">
        {data?.map((item, index) => <FeedEntry key={item.Id} item={item} rank={tab === 'top' ? index + 1 : undefined} upcoming={tab === 'upcoming'} />)}
      </ol>
    </div>
  );
}

function FeedEntry({ item, rank, upcoming }: { item: Item; rank?: number; upcoming: boolean }) {
  const client = useClient();
  const play = usePlay();
  const detail = useDetailLink();
  const art = backdropImage(client.serverUrl, item, 800);
  const logo = logoImage(client.serverUrl, item, 400);
  const date = item.PremiereDate ? new Date(item.PremiereDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }) : '';
  return (
    <li className="feed__entry">
      {rank !== undefined && <span className="feed__rank">{rank}</span>}
      <div className="feed__card">
        <button type="button" className="feed__art" onClick={() => detail.open(item)} aria-label={`Infos zu ${item.SeriesName ?? item.Name}`}>
          {art && <img src={art} alt="" loading="lazy" />}
        </button>
        <div className="feed__head">
          {logo ? <img className="feed__logo" src={logo} alt={item.SeriesName ?? item.Name} loading="lazy" /> : <h2>{item.SeriesName ?? item.Name}</h2>}
          {!upcoming && (
            <div className="feed__actions">
              <button type="button" className="text-action" onClick={() => void play(item)}>
                <IconPlay />
                <span>Abspielen</span>
              </button>
              <div className="text-action">
                <MyListButton item={item} />
                <span>Meine Liste</span>
              </div>
              <button type="button" className="text-action" onClick={() => detail.open(item)}>
                <IconInfo />
                <span>Infos</span>
              </button>
            </div>
          )}
        </div>
        {upcoming && date && <p className="feed__date">Ab {date}</p>}
        {upcoming && item.Type === 'Episode' && <p className="feed__episode">{episodeCode(item)} {item.Name}</p>}
        {item.Overview && <p className="feed__overview">{item.Overview}</p>}
        {item.Genres && item.Genres.length > 0 && (
          <ul className="genre-dots">
            {item.Genres.slice(0, 4).map((g) => <li key={g}>{g}</li>)}
          </ul>
        )}
      </div>
    </li>
  );
}

// --- Suche -------------------------------------------------------------------------------------

export function SearchPage() {
  const client = useClient();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const raw = params.get('q') ?? '';
  const term = useDebounced(raw.trim(), 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', term],
    enabled: term.length > 0,
    placeholderData: (previous) => previous,
    queryFn: async () => (await client.items({ searchTerm: term, includeItemTypes: ['Movie', 'Series', 'BoxSet', 'Video'], limit: 60 })).Items,
  });

  const { data: hints } = useQuery({
    queryKey: ['search-hints', term],
    enabled: term.length > 0,
    queryFn: async () => (await client.searchHints(term, 12)).SearchHints.filter((h) => h.Type === 'Person' || h.Type === 'Genre'),
  });

  const { data: suggested } = useQuery({
    queryKey: ['search-suggested'],
    enabled: term.length === 0,
    staleTime: Infinity,
    queryFn: async () => (await client.items({ includeItemTypes: ['Movie', 'Series'], sortBy: 'Random', limit: 24, imageTypes: 'Backdrop' })).Items,
  });

  return (
    <div className="page search-page">
      {isMobile && (
        <div className="search-page__bar">
          <button type="button" className="icon-btn" aria-label="Zurück" onClick={() => navigate('/browse')}>
            <IconBack />
          </button>
          <label className="search-page__input">
            <IconSearch width={18} height={18} />
            <input
              type="search"
              autoFocus
              value={raw}
              placeholder="Titel, Personen, Genres suchen"
              aria-label="Suchen"
              onChange={(e) => navigate(`/search?q=${encodeURIComponent(e.target.value)}`, { replace: true })}
            />
            {raw && (
              <button type="button" className="icon-btn" aria-label="Suche löschen" onClick={() => navigate('/search', { replace: true })}>
                <IconClose width={18} height={18} />
              </button>
            )}
          </label>
        </div>
      )}
      {hints && hints.length > 0 && (
        <p className="search-page__explore">
          <span>Mehr erkunden:</span>
          {hints.map((h) => {
            const id = h.ItemId ?? h.Id;
            const base = h.Type === 'Person' ? 'person' : 'genre';
            return (
              <Link key={`${h.Type}-${id}`} to={`/browse/${base}/${id}?name=${encodeURIComponent(h.Name)}`}>{h.Name}</Link>
            );
          })}
        </p>
      )}
      {term.length === 0 && suggested && (
        <>
          <h2 className="search-page__heading">Empfohlene Serien und Filme</h2>
          {isMobile ? (
            <ol className="search-list">
              {suggested.map((item) => <SearchListEntry key={item.Id} item={item} />)}
            </ol>
          ) : (
            <ItemGrid items={suggested} />
          )}
        </>
      )}
      {term.length > 0 && results && results.length > 0 && (
        <>
          {isMobile && <h2 className="search-page__heading">Filme und Serien</h2>}
          <ItemGrid items={results} />
        </>
      )}
      {term.length > 0 && results && results.length === 0 && !isFetching && (
        <div className="search-empty">
          <p>Deine Suche nach „{term}“ ergab keine Treffer.</p>
          <p>Vorschläge:</p>
          <ul>
            <li>Andere Suchbegriffe verwenden</li>
            <li>Nach einem Filmtitel oder einer Serie suchen</li>
            <li>Nach einer Person oder einem Genre suchen</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function SearchListEntry({ item }: { item: Item }) {
  const client = useClient();
  const detail = useDetailLink();
  const play = usePlay();
  const art = landscapeImage(client.serverUrl, item, 320);
  return (
    <li className="search-list__entry">
      <Link to={detail.hrefFor(item)} {...detail.stateFor()} className="search-list__link">
        {art ? <img src={art} alt="" loading="lazy" /> : <span className="search-list__blank" />}
        <span>{item.Name}</span>
      </Link>
      <button type="button" className="search-list__play" aria-label={`${item.Name} abspielen`} onClick={() => void play(item)}>
        <IconPlay width={16} height={16} />
      </button>
    </li>
  );
}

// --- Genre, Person, Sprachen, Kategorien -------------------------------------------------------

export function GenrePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const name = params.get('name') ?? 'Genre';
  const type = params.get('type');
  const [sort, setSort] = useState('Random');
  return (
    <div className="page">
      <div className="page-title page-title--with-action">
        <PageTitle back>{name}</PageTitle>
        <Dropdown
          label="Sortieren"
          value={sort}
          options={[
            { value: 'Random', label: 'Vorschläge für dich' },
            { value: 'DateCreated', label: 'Zuletzt hinzugefügt' },
            { value: 'ProductionYear', label: 'Erscheinungsjahr' },
            { value: 'SortName', label: 'A–Z' },
            { value: 'CommunityRating', label: 'Bewertung' },
          ]}
          onChange={setSort}
        />
      </div>
      <InfiniteGrid
        queryKey={['genre', id, type, sort]}
        params={{
          genreIds: [id],
          includeItemTypes: type ? [type] : ['Movie', 'Series'],
          sortBy: sort,
          sortOrder: sort === 'SortName' ? 'Ascending' : 'Descending',
        }}
      />
    </div>
  );
}

export function PersonPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  return (
    <div className="page">
      <PageTitle back>{params.get('name') ?? 'Person'}</PageTitle>
      <InfiniteGrid
        queryKey={['person', id]}
        params={{ personIds: [id], includeItemTypes: ['Movie', 'Series'], sortBy: 'ProductionYear,SortName', sortOrder: 'Descending' }}
      />
    </div>
  );
}

const LANGUAGES: { value: string; label: string }[] = [
  ['deu', 'Deutsch'], ['eng', 'Englisch'], ['fra', 'Französisch'], ['spa', 'Spanisch'], ['ita', 'Italienisch'],
  ['por', 'Portugiesisch'], ['nld', 'Niederländisch'], ['pol', 'Polnisch'], ['rus', 'Russisch'], ['tur', 'Türkisch'],
  ['jpn', 'Japanisch'], ['kor', 'Koreanisch'], ['zho', 'Chinesisch'], ['hin', 'Hindi'], ['ara', 'Arabisch'],
  ['swe', 'Schwedisch'], ['nor', 'Norwegisch'], ['dan', 'Dänisch'], ['fin', 'Finnisch'],
].map(([value, label]) => ({ value, label }));

export function LanguagesPage() {
  const [kind, setKind] = useState<'audioLanguages' | 'subtitleLanguages'>('audioLanguages');
  const [language, setLanguage] = useState('deu');
  const [sort, setSort] = useState('SortName');
  return (
    <div className="page">
      <PageTitle>Nach Sprachen durchsuchen</PageTitle>
      <div className="filter-bar">
        <Dropdown
          label="Art"
          value={kind}
          options={[
            { value: 'audioLanguages', label: 'Originalton und Synchronisation' },
            { value: 'subtitleLanguages', label: 'Untertitel' },
          ]}
          onChange={(v) => setKind(v as typeof kind)}
        />
        <Dropdown label="Sprache" value={language} options={LANGUAGES} onChange={setLanguage} />
        <Dropdown
          label="Sortieren"
          value={sort}
          options={[
            { value: 'SortName', label: 'A–Z' },
            { value: 'DateCreated', label: 'Zuletzt hinzugefügt' },
            { value: 'CommunityRating', label: 'Bewertung' },
          ]}
          onChange={setSort}
        />
      </div>
      <InfiniteGrid
        queryKey={['languages', kind, language, sort]}
        empty="Für diese Sprache wurden keine Titel gefunden."
        params={{
          [kind]: [language],
          includeItemTypes: ['Movie', 'Episode'],
          sortBy: sort,
          sortOrder: sort === 'SortName' ? 'Ascending' : 'Descending',
        }}
      />
    </div>
  );
}

/** Mobile "Kategorien" overlay: full-screen list of genres. */
export function CategoriesPage() {
  const client = useClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['genres', 'all'],
    staleTime: Infinity,
    queryFn: async () => (await client.genres({ includeItemTypes: ['Movie', 'Series'] })).Items,
  });
  return (
    <div className="categories">
      <button type="button" className="round-btn round-btn--white categories__close" aria-label="Schließen" onClick={() => navigate(-1)}>
        ×
      </button>
      <ul>
        <li><Link to="/browse">Startseite</Link></li>
        <li><Link to="/browse/my-list">Meine Liste</Link></li>
        <li><Link to="/browse/languages">Nach Sprachen durchsuchen</Link></li>
        {data?.map((g) => (
          <li key={g.Id}>
            <Link to={`/browse/genre/${g.Id}?name=${encodeURIComponent(g.Name)}`}>{g.Name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
