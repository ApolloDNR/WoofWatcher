-- Make private care-log isolation durable and queryable without trusting an
-- open-ended JSON payload. The API remains the only supported data path; RLS
-- is reasserted as a deny-by-default backstop for client roles.

begin;

alter table public.care_entries
  add column if not exists household_visible boolean;

-- A present malformed visibility value is never equivalent to legacy absence.
-- Normalize both authorities to explicit private before the column backfill.
update public.care_entries
set details = jsonb_set(
      coalesce(details, '{}'::jsonb),
      '{householdVisible}',
      'false'::jsonb,
      true
    ),
    household_visible = false
where coalesce(details, '{}'::jsonb) ? 'householdVisible'
  and jsonb_typeof(details -> 'householdVisible') <> 'boolean';

update public.care_entries
set household_visible = case
  when not (coalesce(details, '{}'::jsonb) ? 'householdVisible') then true
  when jsonb_typeof(details -> 'householdVisible') = 'boolean'
    then (details ->> 'householdVisible')::boolean
  else false
end
where household_visible is null;

-- A historical private row without an attributable creator must stay hidden,
-- not be promoted to household-visible merely to satisfy a constraint.
update public.care_entries
set caregiver_user_id = 'legacy-unattributed:' || id::text
where household_visible = false
  and caregiver_user_id is null;

alter table public.care_entries
  alter column household_visible set default true,
  alter column household_visible set not null;

alter table public.care_entries
  drop constraint if exists care_entries_visibility_details_match,
  add constraint care_entries_visibility_details_match check (
    household_visible = case
      when not (coalesce(details, '{}'::jsonb) ? 'householdVisible') then true
      when jsonb_typeof(details -> 'householdVisible') = 'boolean'
        then (details ->> 'householdVisible')::boolean
      else false
    end
  ),
  drop constraint if exists care_entries_private_creator_required,
  add constraint care_entries_private_creator_required check (
    household_visible or caregiver_user_id is not null
  );

alter table public.care_entry_tombstones
  add column if not exists caregiver_user_id text,
  add column if not exists household_visible boolean;

-- Old tombstones cannot be reliably classified after their source row has
-- gone. Fail them closed to the deleting user (or an unreachable sentinel)
-- instead of risking disclosure of a formerly private entry.
update public.care_entry_tombstones
set caregiver_user_id = coalesce(
      caregiver_user_id,
      deleted_by_user_id,
      'legacy-unattributed:' || id::text
    ),
    household_visible = false
where caregiver_user_id is null
   or household_visible is null;

alter table public.care_entry_tombstones
  alter column caregiver_user_id set not null,
  alter column household_visible set default false,
  alter column household_visible set not null;

drop index if exists public.care_entries_household_client_key_uidx;
create unique index if not exists care_entries_household_creator_client_key_uidx
  on public.care_entries (
    household_id,
    caregiver_user_id,
    (details ->> 'clientKey')
  )
  where caregiver_user_id is not null
    and details ->> 'clientKey' is not null;

revoke all on public.care_entries, public.care_entry_tombstones
  from anon, authenticated;
alter table public.care_entries enable row level security;
alter table public.care_entry_tombstones enable row level security;

comment on column public.care_entries.household_visible is
  'Server authorization authority for shared versus creator-only care entries.';
comment on column public.care_entry_tombstones.household_visible is
  'Visibility inherited from the deleted care entry.';
comment on column public.care_entry_tombstones.caregiver_user_id is
  'Original entry creator used to scope private delete propagation.';

commit;
