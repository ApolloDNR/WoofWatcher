-- Prevent a stale idempotent CREATE from resurrecting a care entry after a
-- different device has deleted the acknowledged row, including when DELETE
-- wins before POST commits. POST and DELETE share the household transaction
-- serializer; this durable key is the committed deletion authority that POST
-- checks while holding that lock.

begin;

alter table public.care_entry_tombstones
  add column if not exists client_key text;

create unique index if not exists
  care_entry_tombstones_household_creator_client_key_uidx
  on public.care_entry_tombstones (
    household_id,
    caregiver_user_id,
    client_key
  )
  where client_key is not null;

comment on column public.care_entry_tombstones.client_key is
  'Normalized opaque idempotency key copied from a deleted care entry or committed before its create; scoped by household and original creator.';

comment on column public.care_entry_tombstones.entry_id is
  'Deleted care-entry id when known; otherwise a synthetic UUID for a creator-private pre-create revocation whose authoritative identity is client_key.';

commit;
