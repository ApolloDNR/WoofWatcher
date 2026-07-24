-- Private care-entry authorization is enforced by durable columns instead of
-- trusting the client-only details flag. Existing private rows are backfilled
-- before the API begins querying the new boundary.
begin;

alter table public.care_entries
  add column if not exists household_visible boolean not null default true;

update public.care_entries
set household_visible = false
where details ->> 'householdVisible' = 'false';

alter table public.care_entry_tombstones
  add column if not exists household_visible boolean not null default true,
  add column if not exists caregiver_user_id text;

-- Tombstones written before this migration do not carry enough information to
-- prove they were household-visible. Quarantine all of them and retain the
-- deleting user as the best available creator identity.
update public.care_entry_tombstones
set
  household_visible = false,
  caregiver_user_id = coalesce(caregiver_user_id, deleted_by_user_id);

-- During a rolling deploy, an older API process can omit the new visibility
-- column while still sending details.householdVisible. Keep the database
-- boundary authoritative for both old and new writers.
create or replace function public.derive_care_entry_visibility()
returns trigger
language plpgsql
as $$
begin
  new.household_visible := case
    when new.details ->> 'householdVisible' = 'false' then false
    else true
  end;
  return new;
end;
$$;

drop trigger if exists care_entries_visibility_guard
  on public.care_entries;
create trigger care_entries_visibility_guard
before insert or update on public.care_entries
for each row execute function public.derive_care_entry_visibility();

-- Older API processes also omit tombstone creator/visibility columns. A
-- tombstone without an original creator must fail closed: only the deleting
-- user receives it until a newer writer can persist the original boundary.
create or replace function public.quarantine_unowned_care_entry_tombstone()
returns trigger
language plpgsql
as $$
begin
  if new.caregiver_user_id is null then
    new.caregiver_user_id := new.deleted_by_user_id;
    new.household_visible := false;
  end if;
  return new;
end;
$$;

drop trigger if exists care_entry_tombstones_visibility_guard
  on public.care_entry_tombstones;
create trigger care_entry_tombstones_visibility_guard
before insert or update on public.care_entry_tombstones
for each row execute function public.quarantine_unowned_care_entry_tombstone();

commit;
