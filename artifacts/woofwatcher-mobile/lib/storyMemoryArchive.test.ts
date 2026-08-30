import assert from "node:assert/strict";
import test from "node:test";

import {
  createStoryMemoryArchiveIdentity,
  selectStoryMemoryArchivePage,
  type StoryMemoryArchiveItem,
} from "./storyMemoryArchive.ts";

type FixtureItem = StoryMemoryArchiveItem & { title: string };

test("selectStoryMemoryArchivePage keeps only one page and clamps a stale page", () => {
  const items: FixtureItem[] = [
    {
      id: "future",
      title: "Future photo",
      availableAt: 400,
      identityKey: "Future photo",
    },
    {
      id: "always",
      title: "Saved memory",
      availableAt: null,
      identityKey: "Saved memory",
    },
    { id: "three", title: "Third", availableAt: 250, identityKey: "Third" },
    { id: "two", title: "Second", availableAt: 200, identityKey: "Second" },
    { id: "one", title: "First", availableAt: 100, identityKey: "First" },
  ];

  const page = selectStoryMemoryArchivePage(items, {
    now: 300,
    pageSize: 2,
    collectionIdentity: "archive-a",
    pagination: { collectionIdentity: "archive-a", page: 99 },
  });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["two", "one"],
  );
  assert.equal(page.total, 4);
  assert.equal(page.pageStart, 2);
  assert.equal(page.pageEnd, 4);
  assert.deepEqual(page.pagination, {
    collectionIdentity: "archive-a",
    page: 1,
  });
});

test("selectStoryMemoryArchivePage resets immediately when a same-size collection is replaced", () => {
  const items: FixtureItem[] = [
    { id: "newest", title: "Newest", availableAt: null, identityKey: "Newest" },
    { id: "middle", title: "Middle", availableAt: null, identityKey: "Middle" },
    { id: "oldest", title: "Oldest", availableAt: null, identityKey: "Oldest" },
  ];

  const page = selectStoryMemoryArchivePage(items, {
    now: 300,
    pageSize: 2,
    collectionIdentity: "replacement",
    pagination: { collectionIdentity: "original", page: 1 },
  });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["newest", "middle"],
  );
  assert.deepEqual(page.pagination, {
    collectionIdentity: "replacement",
    page: 0,
  });
});

test("archive identity tracks relevant content but ignores equivalent object replacement", () => {
  const original: FixtureItem[] = [
    { id: "one", title: "First", availableAt: 100, identityKey: "First" },
    { id: "two", title: "Second", availableAt: null, identityKey: "Second" },
  ];
  const equivalent = original.map((item) => ({ ...item }));
  const sameLengthReplacement: FixtureItem[] = [
    {
      id: "one",
      title: "First updated",
      availableAt: 100,
      identityKey: "First updated",
    },
    { id: "three", title: "Third", availableAt: null, identityKey: "Third" },
  ];

  assert.equal(
    createStoryMemoryArchiveIdentity(equivalent),
    createStoryMemoryArchiveIdentity(original),
  );
  assert.notEqual(
    createStoryMemoryArchiveIdentity(sameLengthReplacement),
    createStoryMemoryArchiveIdentity(original),
  );
});
