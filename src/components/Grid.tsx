import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Item } from '../api/types';
import { useClient } from '../state/session';
import { Card } from './Card';

export function ItemGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid">
      {items.map((item) => (
        <Card key={item.Id} item={item} />
      ))}
    </div>
  );
}

const PAGE_SIZE = 48;

/** Paged `/Items` grid; the next page loads as the sentinel nears the viewport. */
export function InfiniteGrid({
  queryKey,
  params,
  empty,
}: {
  queryKey: unknown[];
  params: Record<string, string | number | boolean | string[] | undefined>;
  empty?: string;
}) {
  const client = useClient();
  const sentinel = useRef<HTMLDivElement>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => client.items({ ...params, startIndex: pageParam, limit: PAGE_SIZE }, signal),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.Items.length, 0);
      return loaded < last.TotalRecordCount && last.Items.length > 0 ? loaded : undefined;
    },
  });

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '800px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <div className="center-spinner"><div className="spinner" /></div>;
  if (isError) return <p className="empty-note">Die Titel konnten nicht geladen werden.</p>;

  const items = data?.pages.flatMap((p) => p.Items) ?? [];
  if (items.length === 0) return <p className="empty-note">{empty ?? 'Keine Titel gefunden.'}</p>;

  return (
    <>
      <ItemGrid items={items} />
      <div ref={sentinel} />
      {isFetchingNextPage && <div className="center-spinner"><div className="spinner" /></div>}
    </>
  );
}
