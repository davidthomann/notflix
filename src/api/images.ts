import type { Item } from './types';

interface ImageOptions {
  maxWidth?: number;
  quality?: number;
}

function imageUrl(server: string, id: string, type: string, tag: string, opts: ImageOptions = {}, index?: number) {
  const params = new URLSearchParams({ tag, quality: String(opts.quality ?? 90) });
  if (opts.maxWidth) params.set('maxWidth', String(opts.maxWidth));
  const suffix = index === undefined ? '' : `/${index}`;
  return `${server}/Items/${id}/Images/${type}${suffix}?${params}`;
}

/**
 * Landscape artwork for wide cards. Backdrop plus logo gives the cleanest result, so it wins over a
 * Thumb, which usually has the title painted in (`hasTitle`: don't draw another title on top).
 */
export function landscapeSource(server: string, item: Item, maxWidth = 640): { url: string; hasTitle: boolean } | null {
  const opts = { maxWidth };
  // Episodes show their own still.
  if (item.Type === 'Episode' && item.ImageTags?.Primary) {
    return { url: imageUrl(server, item.Id, 'Primary', item.ImageTags.Primary, opts), hasTitle: false };
  }
  if (item.ImageTags?.Logo && item.BackdropImageTags?.[0]) {
    return { url: imageUrl(server, item.Id, 'Backdrop', item.BackdropImageTags[0], opts, 0), hasTitle: false };
  }
  if (item.ImageTags?.Thumb) return { url: imageUrl(server, item.Id, 'Thumb', item.ImageTags.Thumb, opts), hasTitle: true };
  if (item.BackdropImageTags?.[0]) {
    return { url: imageUrl(server, item.Id, 'Backdrop', item.BackdropImageTags[0], opts, 0), hasTitle: false };
  }
  if (item.ParentThumbItemId && item.ParentThumbImageTag) {
    return { url: imageUrl(server, item.ParentThumbItemId, 'Thumb', item.ParentThumbImageTag, opts), hasTitle: true };
  }
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.[0]) {
    return { url: imageUrl(server, item.ParentBackdropItemId, 'Backdrop', item.ParentBackdropImageTags[0], opts, 0), hasTitle: false };
  }
  if (item.ImageTags?.Primary) return { url: imageUrl(server, item.Id, 'Primary', item.ImageTags.Primary, opts), hasTitle: false };
  return null;
}

export function landscapeImage(server: string, item: Item, maxWidth = 640): string | null {
  return landscapeSource(server, item, maxWidth)?.url ?? null;
}

export function posterImage(server: string, item: Item, maxWidth = 400): string | null {
  if (item.Type === 'Episode' && item.SeriesId && item.SeriesPrimaryImageTag) {
    return imageUrl(server, item.SeriesId, 'Primary', item.SeriesPrimaryImageTag, { maxWidth });
  }
  if (item.ImageTags?.Primary) return imageUrl(server, item.Id, 'Primary', item.ImageTags.Primary, { maxWidth });
  return landscapeImage(server, item, maxWidth);
}

export function backdropImage(server: string, item: Item, maxWidth = 1920): string | null {
  if (item.BackdropImageTags?.[0]) {
    return imageUrl(server, item.Id, 'Backdrop', item.BackdropImageTags[0], { maxWidth }, 0);
  }
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.[0]) {
    return imageUrl(server, item.ParentBackdropItemId, 'Backdrop', item.ParentBackdropImageTags[0], { maxWidth }, 0);
  }
  return landscapeImage(server, item, maxWidth);
}

export function logoImage(server: string, item: Item, maxWidth = 600): string | null {
  if (item.ImageTags?.Logo) return imageUrl(server, item.Id, 'Logo', item.ImageTags.Logo, { maxWidth });
  if (item.ParentLogoItemId && item.ParentLogoImageTag) {
    return imageUrl(server, item.ParentLogoItemId, 'Logo', item.ParentLogoImageTag, { maxWidth });
  }
  return null;
}

export function userImage(server: string, userId: string, tag?: string | null, size = 200): string | null {
  if (!tag) return null;
  const params = new URLSearchParams({ userId, tag, maxWidth: String(size), quality: '90' });
  return `${server}/UserImage?${params}`;
}

export function personImage(server: string, id: string, tag?: string | null, maxWidth = 200): string | null {
  return tag ? imageUrl(server, id, 'Primary', tag, { maxWidth }) : null;
}
