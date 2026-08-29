export interface StoryMemoryArchiveItem {
  id: string;
  /** Null means the item is already saved and is not gated by wall-clock time. */
  availableAt: number | null;
  /** Relevant display fields serialized by the archive builder. */
  identityKey: string;
}

export interface StoryMemoryArchivePagination {
  collectionIdentity: string;
  page: number;
}

export interface StoryMemoryArchivePage<TItem> {
  items: TItem[];
  total: number;
  pageStart: number;
  pageEnd: number;
  pagination: StoryMemoryArchivePagination;
}

export function createStoryMemoryArchiveIdentity(
  items: readonly StoryMemoryArchiveItem[],
): string {
  return JSON.stringify(
    items.map((item) => [item.id, item.availableAt, item.identityKey]),
  );
}

export function selectStoryMemoryArchivePage<
  TItem extends StoryMemoryArchiveItem,
>(
  items: readonly TItem[],
  input: {
    now: number;
    pageSize: number;
    collectionIdentity: string;
    pagination: StoryMemoryArchivePagination;
  },
): StoryMemoryArchivePage<TItem> {
  const pageSize = Math.max(1, Math.floor(input.pageSize));
  const isAvailable = (item: TItem) =>
    item.availableAt === null ||
    (Number.isFinite(item.availableAt) && item.availableAt <= input.now);

  let total = 0;
  for (const item of items) {
    if (isAvailable(item)) total += 1;
  }

  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const requestedPage =
    input.pagination.collectionIdentity === input.collectionIdentity
      ? input.pagination.page
      : 0;
  const page = Math.min(
    maxPage,
    Math.max(0, Math.floor(Number.isFinite(requestedPage) ? requestedPage : 0)),
  );
  const pageStart = page * pageSize;
  const pageEnd = Math.min(total, pageStart + pageSize);
  const pageItems: TItem[] = [];
  let visibleIndex = 0;

  for (const item of items) {
    if (!isAvailable(item)) continue;
    if (visibleIndex >= pageStart && visibleIndex < pageEnd) {
      pageItems.push(item);
    }
    visibleIndex += 1;
    if (visibleIndex >= pageEnd) break;
  }

  return {
    items: pageItems,
    total,
    pageStart,
    pageEnd,
    pagination: { collectionIdentity: input.collectionIdentity, page },
  };
}
