import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { RecommendationDto } from '../api/types';
import { Billboard, useBillboardItem } from '../components/Billboard';
import { Dropdown } from '../components/Dropdown';
import { LazyRow, Row } from '../components/Row';
import { seededShuffle } from '../lib/format';
import { useIsMobile } from '../lib/hooks';
import { useClient } from '../state/session';

type Scope = 'home' | 'series' | 'movies';

const SCOPE_TYPES: Record<Scope, string[]> = {
  home: ['Movie', 'Series'],
  series: ['Series'],
  movies: ['Movie'],
};

/** Library kinds that hold videos; music, books and photos have no place in this UI. */
const VIDEO_COLLECTIONS = new Set(['movies', 'tvshows', 'homevideos', 'musicvideos', 'mixed']);

export function useVideoViews() {
  const client = useClient();
  return useQuery({
    queryKey: ['views'],
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await client.views()).Items.filter((v) => !v.CollectionType || VIDEO_COLLECTIONS.has(v.CollectionType)),
  });
}

/** Order random rows once per page load so they stay put during a visit. */
const sessionSeed = Math.floor(Math.random() * 100_000);

function recommendationTitle(rec: RecommendationDto): string {
  const name = rec.BaselineItemName ?? '';
  switch (rec.RecommendationType) {
    case 'SimilarToRecentlyPlayed':
      return `Weil du „${name}“ angesehen hast`;
    case 'SimilarToLikedItem':
      return `Weil dir „${name}“ gefällt`;
    case 'HasDirectorFromRecentlyPlayed':
    case 'HasLikedDirector':
      return `Regie: ${name}`;
    case 'HasActorFromRecentlyPlayed':
    case 'HasLikedActor':
      return `Mit ${name}`;
    default:
      return name || 'Für dich empfohlen';
  }
}

export function BrowsePage({ scope }: { scope: Scope }) {
  const client = useClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const types = SCOPE_TYPES[scope];
  const { data: hero, isLoading: heroLoading } = useBillboardItem(types);
  const { data: views } = useVideoViews();

  const { data: genres } = useQuery({
    queryKey: ['genres', scope],
    staleTime: Infinity,
    queryFn: async () => (await client.genres({ includeItemTypes: types })).Items,
  });
  const shuffledGenres = useMemo(() => seededShuffle(genres ?? [], sessionSeed), [genres]);

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', scope],
    enabled: scope !== 'series',
    staleTime: Infinity,
    queryFn: () => client.recommendations(),
  });

  const scopedViews = useMemo(
    () =>
      views?.filter((v) => {
        if (scope === 'movies') return v.CollectionType === 'movies';
        if (scope === 'series') return v.CollectionType === 'tvshows';
        return true;
      }) ?? [],
    [views, scope],
  );

  const resumeTypes = scope === 'series' ? ['Episode'] : scope === 'movies' ? ['Movie'] : undefined;
  const typeLabel = scope === 'series' ? 'Serien' : scope === 'movies' ? 'Filme' : null;

  return (
    <div className={`browse browse--${scope}`}>
      {scope !== 'home' && !isMobile && (
        <div className="browse__subnav">
          <h1>{typeLabel}</h1>
          {genres && genres.length > 0 && (
            <Dropdown
              label="Genres"
              columns={genres.length > 12 ? 3 : 1}
              options={genres.map((g) => ({ value: g.Id, label: g.Name }))}
              onChange={(id) => {
                const g = genres.find((x) => x.Id === id)!;
                navigate(`/browse/genre/${id}?name=${encodeURIComponent(g.Name)}&type=${types[0]}`);
              }}
            />
          )}
        </div>
      )}
      {hero && <Billboard item={hero} />}
      {heroLoading && <div className="billboard billboard--loading" />}
      <div className={`rows${hero ? ' rows--overlap' : ''}`}>
        <LazyRow
          eager
          queryKey={['resume', scope]}
          title="Weiterschauen"
          variant="resume"
          fetch={async () => {
            const items = (await client.resume()).Items;
            return resumeTypes ? items.filter((i) => resumeTypes.includes(i.Type)) : items;
          }}
        />
        {scope !== 'movies' && (
          <LazyRow eager queryKey={['nextup', 'row']} title="Nächste Folgen" variant="resume" fetch={async () => (await client.nextUp()).Items} />
        )}
        <LazyRow
          queryKey={['mylist', 'row', scope]}
          title="Meine Liste"
          to="/browse/my-list"
          fetch={async () => (await client.items({ isFavorite: true, includeItemTypes: types, sortBy: 'DateCreated', sortOrder: 'Descending', limit: 30 })).Items}
        />
        {scope !== 'series' && <TopTenRow type="Movie" title="Top 10 Filme" />}
        {scope !== 'movies' && <TopTenRow type="Series" title="Top 10 Serien" />}
        {scopedViews.map((view) => (
          <LazyRow
            key={view.Id}
            queryKey={['latest', view.Id]}
            title={`Neu in ${view.Name}`}
            fetch={() => client.latest({ parentId: view.Id })}
          />
        ))}
        {recommendations?.filter((rec) => rec.Items.length > 0).map((rec) => (
          <Row key={rec.CategoryId} title={recommendationTitle(rec)} items={rec.Items} />
        ))}
        <LazyRow
          queryKey={['critics', scope]}
          title="Von Kritikern gefeiert"
          minItems={3}
          fetch={async () =>
            (await client.items({ includeItemTypes: types, sortBy: 'CriticRating', sortOrder: 'Descending', minCriticRating: 70, limit: 30 })).Items
          }
        />
        {scope === 'home' && (
          <LazyRow
            queryKey={['boxsets']}
            title="Filmreihen und Sammlungen"
            fetch={async () => (await client.items({ includeItemTypes: ['BoxSet'], sortBy: 'SortName', limit: 30 })).Items}
          />
        )}
        <LazyRow
          queryKey={['rewatch', scope]}
          title="Nochmal ansehen"
          minItems={3}
          fetch={async () => (await client.items({ includeItemTypes: types, isPlayed: true, sortBy: 'DatePlayed', sortOrder: 'Descending', limit: 30 })).Items}
        />
        {shuffledGenres.slice(0, 16).map((genre) => (
          <LazyRow
            key={genre.Id}
            stable
            queryKey={['genre-row', scope, genre.Id]}
            title={genre.Name}
            to={`/browse/genre/${genre.Id}?name=${encodeURIComponent(genre.Name)}${scope === 'home' ? '' : `&type=${types[0]}`}`}
            fetch={async () => (await client.items({ genreIds: [genre.Id], includeItemTypes: types, sortBy: 'Random', limit: 30 })).Items}
          />
        ))}
      </div>
    </div>
  );
}

export function TopTenRow({ type, title }: { type: 'Movie' | 'Series'; title: string }) {
  const client = useClient();
  return (
    <LazyRow
      queryKey={['top10', type]}
      title={title}
      variant="top10"
      minItems={3}
      fetch={async () =>
        (await client.items({ includeItemTypes: [type], sortBy: 'CommunityRating,SortName', sortOrder: 'Descending', minCommunityRating: 0.1, limit: 10 })).Items
      }
    />
  );
}
