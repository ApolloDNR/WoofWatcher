# Data Safety Engineering

Local-first means the device store IS the product. Data loss is the one
bug class that kills the app. These laws were extracted from a confirmed
adversarial audit (every one had a real reproduction) - hold all
persistence/sync work to them.

## Laws of the store (`context/CareContext.tsx`)

1. **Never overwrite data you failed to read.** `hydrated` gates the
   persist effect and may only flip true after a read that COMPLETED. A
   rejected `getItem` retries once, then leaves persistence paused for the
   session (in-memory care still works) - never clobber what you couldn't
   read.
2. **Back up before any reset.** A corrupt cache is copied to
   `<STORAGE_KEY>.recovery` BEFORE defaults can persist over it, and the
   owner is told (`storageWarning: "reset"`). Malformed entries are
   filtered on load (an id-less row used to boot-loop outbox derivation).
3. **Surface failed persists.** The persist effect sets
   `storageWarning: "save-failed"` on error and clears it on recovery;
   Home renders the amber alert. Never `.catch(() => {})` the primary
   store.
4. **No side effects inside setState updaters.** React defers updaters
   when earlier updates are pending; values captured inside come back
   undefined and side effects silently skip (an entry stuck "pending"
   forever). Compute from the eagerly-updated ref
   (`entriesRef.current = next; setEntries(...)`), then run effects.
5. **The erase generation guards every post-await write.** Any code path
   that `await`s and then writes doc/entries state (or the server) must
   capture `eraseGenerationRef.current` first and re-check after EVERY
   await. A wipe during a slow network call must not be resurrected by its
   resolution - not by a delete's failure-restore, not by a push's
   conflict-merge, not by a sync's post-PUT set.
6. **A pristine doc never wins reconciliation.** `getDefaultDoc()` stamps
   epoch `updatedAt`; only real edits stamp real time. Without this, a
   fresh install signing in "won" last-writer-wins and erased the whole
   household's doc with defaults.
7. **Conflict replays use the LATEST local doc** (`docRef.current`), never
   the snapshot the push captured - edits made mid-flight must survive.
8. **Creates are idempotent.** Client stamps `details.clientKey` (the temp
   id - stable across retries); the server dedupes on it; the partial
   unique index `care_entries_household_client_key_uidx` (migration 0003)
   backstops the race; `mergeServerAndLocalEntries` supersedes a temp row
   when its server twin arrives.
9. **The wipe deletes everything the app wrote**: all `woofwatcher*`
   AsyncStorage keys AND the FileSystem dirs (`WoofWatcherReports/`,
   `woofwatcher-attachments/`). The wipe UI always reaches a verdict -
   never hangs on a rejected sub-step.
10. **Durable URIs only.** Anything the OS may purge (ImagePicker cache
    URIs) gets copied into `documentDirectory` before the reference is
    stored.
11. **Transient FS errors are not proof of absence.** Only a resolved
    `exists: false` may prune a stored file reference; a thrown check
    keeps it.

## Open items (do not forget they exist)

Tracked in the current handoff doc: wipe-while-signed-in semantics need an
owner product decision before sync launches; legacy web `v1.state` import;
native device QA for the file behaviors.

## Auditing this layer

When asked to audit persistence (or before major changes to it), spawn an
adversarial reviewer with the hunt list: write races / lost updates, wipe
lifecycle holes, load-failure handling, partial writes, ID collisions,
migration, quota/failure surfacing. Require file:line + a concrete failing
sequence per finding, CONFIRMED vs PLAUSIBLE, and independently verify
findings against source before fixing - auditors can be wrong, and fixes
must preserve the passing suite (148+ tests guarded the last round).
