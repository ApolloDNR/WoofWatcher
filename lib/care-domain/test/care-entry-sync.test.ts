import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CARE_ENTRY_SYNC_REVISION_KEY,
  isNextCareEntrySyncRevision,
  nextCareEntrySyncRevision,
  readCareEntrySyncRevision,
  resolveLegacyCareEntrySyncWriteRevision,
} from "../src/care-entry-sync.ts";

test("care-entry sync revisions advance from persisted server details", () => {
  const details = {
    routeName: "Creek loop",
    [CARE_ENTRY_SYNC_REVISION_KEY]: 7,
  };

  assert.equal(readCareEntrySyncRevision(details), 7);
  assert.equal(nextCareEntrySyncRevision(details), 8);
});

test("care-entry sync revisions start at one for legacy or invalid details", () => {
  assert.equal(readCareEntrySyncRevision(undefined), null);
  assert.equal(
    readCareEntrySyncRevision({
      [CARE_ENTRY_SYNC_REVISION_KEY]: "7",
    }),
    null,
  );
  assert.equal(
    readCareEntrySyncRevision({
      [CARE_ENTRY_SYNC_REVISION_KEY]: 7.5,
    }),
    null,
  );
  assert.equal(
    readCareEntrySyncRevision({
      [CARE_ENTRY_SYNC_REVISION_KEY]:
        Number.MAX_SAFE_INTEGER + 1,
    }),
    null,
  );
  assert.equal(nextCareEntrySyncRevision(undefined), 1);
});

test("partial and legacy care-entry writes advance from the selected server row", () => {
  const storedDetails = {
    [CARE_ENTRY_SYNC_REVISION_KEY]: 7,
    routeName: "Creek loop",
  };

  assert.equal(
    resolveLegacyCareEntrySyncWriteRevision({
      storedDetails,
      requestedDetails: undefined,
      detailsWereSupplied: false,
    }),
    8,
  );
  assert.equal(
    resolveLegacyCareEntrySyncWriteRevision({
      storedDetails,
      requestedDetails: {
        [CARE_ENTRY_SYNC_REVISION_KEY]: 7,
        routeName: "Creek loop",
      },
      detailsWereSupplied: true,
    }),
    8,
  );
  assert.equal(
    resolveLegacyCareEntrySyncWriteRevision({
      storedDetails,
      requestedDetails: { routeName: "Creek loop" },
      detailsWereSupplied: true,
    }),
    8,
  );
});

test("newer desired revisions pass through while stale revisions stay rejectable", () => {
  const storedDetails = {
    [CARE_ENTRY_SYNC_REVISION_KEY]: 20,
  };

  assert.equal(
    resolveLegacyCareEntrySyncWriteRevision({
      storedDetails,
      requestedDetails: {
        [CARE_ENTRY_SYNC_REVISION_KEY]: 21,
      },
      detailsWereSupplied: true,
    }),
    21,
  );
  assert.equal(
    resolveLegacyCareEntrySyncWriteRevision({
      storedDetails,
      requestedDetails: {
        [CARE_ENTRY_SYNC_REVISION_KEY]: 3,
      },
      detailsWereSupplied: true,
    }),
    3,
  );
});

test("current care-entry writes must establish exactly the next revision", () => {
  const storedDetails = {
    [CARE_ENTRY_SYNC_REVISION_KEY]: 8,
  };

  assert.equal(
    isNextCareEntrySyncRevision(storedDetails, {
      [CARE_ENTRY_SYNC_REVISION_KEY]: 9,
    }),
    true,
  );
  assert.equal(
    isNextCareEntrySyncRevision(storedDetails, {
      [CARE_ENTRY_SYNC_REVISION_KEY]: 8,
    }),
    false,
  );
  assert.equal(
    isNextCareEntrySyncRevision(storedDetails, {
      [CARE_ENTRY_SYNC_REVISION_KEY]: 10,
    }),
    false,
  );
  assert.equal(isNextCareEntrySyncRevision(storedDetails, {}), false);
  assert.equal(
    isNextCareEntrySyncRevision(
      { [CARE_ENTRY_SYNC_REVISION_KEY]: Number.MAX_SAFE_INTEGER },
      { [CARE_ENTRY_SYNC_REVISION_KEY]: Number.MAX_SAFE_INTEGER },
    ),
    false,
  );
});
