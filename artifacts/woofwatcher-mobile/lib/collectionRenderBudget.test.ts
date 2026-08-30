import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readMobile(...segments: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...segments), "utf8");
}

test("Log keeps exactly one bounded history page mounted", () => {
  const log = readMobile("app", "(tabs)", "log.tsx");

  assert.match(log, /const \[historyPage, setHistoryPage\] = useState\(0\)/);
  assert.match(
    log,
    /filtered\.slice\(\s*historyPageStart,\s*historyPageStart \+ LOG_HISTORY_PAGE_SIZE/,
  );
  assert.doesNotMatch(log, /slice\(0, historyLimit\)/);
  assert.match(log, /newerHistoryCount > 0/);
  assert.match(log, /olderHistoryCount > 0/);
});

test("Log timeline rows mount a bounded sticky-note preview with a hidden-count affordance", () => {
  const log = readMobile("app", "(tabs)", "log.tsx");

  assert.match(
    log,
    /getTimelineStickyNotePreview\(\s*stickyNotes,\s*LOG_ROW_STICKY_NOTE_LIMIT,?\s*\)/,
  );
  assert.match(log, /visibleStickyNotes\.map\(\(note\) =>/);
  assert.match(log, /hiddenStickyNoteCount > 0/);
  assert.match(log, /earlier sticky/);
  assert.match(log, /in log details/);
});

test("Story memories keep one bounded page and downscale local photos", () => {
  const story = readMobile("components", "more", "StoryProgressScreen.tsx");
  const collectionStart = story.indexOf(
    "const memoryArchiveCollection = useMemo",
  );
  const pageStart = story.indexOf(
    "const memoryArchive = useMemo",
    collectionStart + 1,
  );
  const collectionBlock = story.slice(collectionStart, pageStart);

  assert.ok(
    collectionStart >= 0,
    "Story should build one stable archive collection",
  );
  assert.ok(
    pageStart > collectionStart,
    "Story should paginate after building the collection",
  );
  assert.match(collectionBlock, /state\.adventureMemories/);
  assert.match(collectionBlock, /state\.entries/);
  assert.doesNotMatch(
    collectionBlock,
    /\bnow\b/,
    "the focused 30-second clock must not rebuild or sort the full archive",
  );
  assert.match(story, /createStoryMemoryArchiveIdentity/);
  assert.match(story, /selectStoryMemoryArchivePage/);
  assert.doesNotMatch(story, /items\.slice\(0, memoryLimit\)/);
  assert.match(story, /newerMemoryCount > 0/);
  assert.match(story, /olderMemoryCount > 0/);
  assert.ok(
    (story.match(/<ExpoImage/g)?.length ?? 0) >= 2,
    "walk and memory photos should use the downscaling image pipeline",
  );
  assert.ok(
    (story.match(/allowDownscaling/g)?.length ?? 0) >= 2,
    "camera-sized photos must be decoded near their rendered size",
  );
  assert.ok(
    (story.match(/enforceEarlyResizing/g)?.length ?? 0) >= 2,
    "local iOS photos must receive decoder thumbnail dimensions before decode",
  );
});

test("More and Story use the focused active clock instead of render-time clocks", () => {
  const more = readMobile("app", "(tabs)", "more.tsx");
  const story = readMobile("components", "more", "StoryProgressScreen.tsx");

  assert.match(more, /const now = useActiveCurrentTime\(\)/);
  assert.match(story, /const now = useActiveCurrentTime\(\)/);
  assert.doesNotMatch(more, /const now = Date\.now\(\)/);
  assert.doesNotMatch(story, /const now = Date\.now\(\)/);
});
