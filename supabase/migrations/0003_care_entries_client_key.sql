-- Idempotent care-entry creates: clients stamp details.clientKey (their temp
-- id, stable across retries). The api-server dedupes on it before inserting;
-- this partial unique index backstops the read-then-insert race so two
-- concurrent identical creates can never both land.
create unique index if not exists care_entries_household_client_key_uidx
  on care_entries (household_id, (details ->> 'clientKey'))
  where details ->> 'clientKey' is not null;
