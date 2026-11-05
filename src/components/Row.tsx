import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Item } from '../api/types';
import { useCanHover, useInView, useMediaQuery } from '../lib/hooks';
import { Card, type CardVariant } from './Card';
import { IconChevronLeft, IconChevronRight } from './Icons';

/** Cards per slider page at each viewport width. */
function usePerPage(): number {
  const w1400 = useMediaQuery('(min-width: 1400px)');
  const w1100 = useMediaQuery('(min-width: 1100px)');
  const w800 = useMediaQuery('(min-width: 800px)');
  const w500 = useMediaQuery('(min-width: 500px)');
  if (w1400) return 6;
  if (w1100) return 5;
  if (w800) return 4;
  if (w500) return 3;
  return 2;
}

interface RowProps {
  title: ReactNode;
  items: Item[];
  to?: string;
  variant?: CardVariant;
}

export function Row({ title, items, to, variant = 'wide' }: RowProps) {
  const canHover = useCanHover();
  const perPage = usePerPage();
  const [page, setPage] = useState(0);
  const [touched, setTouched] = useState(false);

  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  // The last page aligns to the row's end instead of leaving a gap.
  const offset = Math.max(0, Math.min(safePage * perPage, items.length - perPage));
  const hasMore = items.length > perPage;

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const go = (delta: number) => {
    setTouched(true);
    setPage((safePage + delta + pageCount) % pageCount);
  };

  const heading = to ? (
    <Link to={to} className="row__title row__title--link">
      <span>{title}</span>
      <span className="row__explore">
        Alle ansehen <IconChevronRight width={14} height={14} />
      </span>
    </Link>
  ) : (
    <div className="row__title">
      <span>{title}</span>
    </div>
  );

  const sliderMode = canHover;

  return (
    <section className={`row row--${variant}${sliderMode ? ' row--slider' : ' row--scroll'}`} aria-roledescription="Karussell">
      <div className="row__head">
        <h2>{heading}</h2>
        {sliderMode && hasMore && (
          <ol className="row__pages" aria-hidden="true">
            {Array.from({ length: pageCount }, (_, i) => (
              <li key={i} className={i === safePage ? 'is-active' : ''} />
            ))}
          </ol>
        )}
      </div>
      <div className="row__viewport">
        {sliderMode && hasMore && touched && (
          <button type="button" className="row__arrow row__arrow--left" aria-label="Zurück" onClick={() => go(-1)}>
            <IconChevronLeft />
          </button>
        )}
        <div
          className="row__track"
          style={
            {
              '--per-page': perPage,
              transform: sliderMode ? `translate3d(${(-offset * 100) / perPage}%, 0, 0)` : undefined,
            } as React.CSSProperties
          }
          onFocus={(e) => {
            if (!sliderMode) return;
            const el = (e.target as HTMLElement).closest<HTMLElement>('.row__item');
            const index = el ? Number(el.dataset.index) : -1;
            if (index >= 0 && (index < offset || index >= offset + perPage)) setPage(Math.floor(index / perPage));
          }}
        >
          {items.map((item, index) => (
            <div className="row__item" data-index={index} key={`${item.Id}-${index}`}>
              <Card item={item} variant={variant} rank={variant === 'top10' ? index + 1 : undefined} />
            </div>
          ))}
        </div>
        {sliderMode && hasMore && (
          <button type="button" className="row__arrow row__arrow--right" aria-label="Weiter" onClick={() => go(1)}>
            <IconChevronRight />
          </button>
        )}
      </div>
    </section>
  );
}

export function RowSkeleton() {
  return (
    <div className="row row--skeleton" aria-hidden="true">
      <div className="row__head">
        <div className="skeleton skeleton--title" />
      </div>
      <div className="row__viewport">
        <div className="row__track" style={{ '--per-page': 6 } as React.CSSProperties}>
          {Array.from({ length: 8 }, (_, i) => (
            <div className="row__item" key={i}>
              <div className="skeleton skeleton--card" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LazyRowProps {
  queryKey: unknown[];
  fetch: () => Promise<Item[]>;
  title: ReactNode;
  to?: string;
  variant?: CardVariant;
  /** Rows with fewer items are hidden. */
  minItems?: number;
  /** Keep the first result for the whole session (randomly ordered rows must not reshuffle). */
  stable?: boolean;
  eager?: boolean;
}

/** Row that fetches its items only when scrolled near the viewport; empty rows disappear. */
export function LazyRow({ queryKey, fetch, title, to, variant, minItems = 1, stable, eager }: LazyRowProps) {
  const [ref, inView] = useInView<HTMLDivElement>('600px');
  const { data, isError } = useQuery({
    queryKey,
    queryFn: fetch,
    enabled: inView || Boolean(eager),
    staleTime: stable ? Infinity : 60_000,
  });

  if (isError) return null;
  if (data && data.length < minItems) return null;
  return (
    <div ref={ref}>
      {data ? <Row title={title} items={data} to={to} variant={variant} /> : <RowSkeleton />}
    </div>
  );
}
