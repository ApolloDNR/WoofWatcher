-- Persist the household a user has explicitly selected. The pointer remains
-- nullable so first sign-in can provision a household atomically and so
-- deleting a household can fail closed by clearing the selection.
--
-- This migration is reviewable repository evidence only until it is applied to the approved
-- provider and that application is captured in release proof.
begin;

alter table public.users
  add column if not exists active_household_id uuid;

-- Freeze membership writes until commit so a row selected by the cleanup or
-- backfill cannot disappear between authority validation and FK installation.
lock table public.household_members in share mode;

-- A partially applied schema or provider-side experiment may already contain
-- a pointer. Preserve it only when that exact user has a membership in the
-- referenced household; otherwise do not let it become durable authority.
update public.users as app_user
set active_household_id = null
where app_user.active_household_id is not null
  and not exists (
    select 1
    from public.household_members as member
    where member.user_id = app_user.id
      and member.household_id = app_user.active_household_id
  );

-- Existing accounts deterministically retain their earliest membership that
-- still grants household access. Role normalization mirrors the api-server's
-- closed canonical/legacy alias set; unknown roles and expired helper passes
-- cannot become active authority during migration.
with earliest_membership as (
  select distinct on (member.user_id)
    member.user_id,
    member.household_id
  from public.household_members as member
  where
    lower(
      btrim(regexp_replace(member.role, '[[:space:]]+', ' ', 'g'))
    ) in (
      'admin', 'adult admin', 'owner',
      'adult', 'member', 'primary caregiver',
      'teen',
      'kid', 'child', 'minor',
      'sitter', 'helper', 'temporary helper',
      'trainer', 'walker',
      'viewer', 'vet', 'vet viewer', 'veterinary viewer',
      'read-only', 'readonly'
    )
    and (
      lower(
        btrim(regexp_replace(member.role, '[[:space:]]+', ' ', 'g'))
      ) not in (
        'sitter', 'helper', 'temporary helper',
        'trainer', 'walker',
        'viewer', 'vet', 'vet viewer', 'veterinary viewer',
        'read-only', 'readonly'
      )
      or member.access_pass_expires_at is null
      or member.access_pass_expires_at > statement_timestamp()
    )
  order by member.user_id, member.created_at, member.id
)
update public.users as app_user
set active_household_id = earliest_membership.household_id
from earliest_membership
where app_user.id = earliest_membership.user_id
  and app_user.active_household_id is null;

-- PostgreSQL has no `add constraint if not exists`, so inspect the exact
-- provider catalog instead of swallowing errors. If the expected name exists
-- with weaker or different semantics, the attempted add fails and rolls the
-- transaction back rather than accepting drift.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conname =
        'users_active_household_id_households_id_fk'
      and constraint_record.conrelid = 'public.users'::regclass
      and constraint_record.contype = 'f'
      and constraint_record.confrelid = 'public.households'::regclass
      and constraint_record.confdeltype = 'n'
      and constraint_record.confupdtype = 'a'
      and not constraint_record.condeferrable
      and constraint_record.convalidated
      and constraint_record.conkey = array[
        (
          select attribute.attnum
          from pg_catalog.pg_attribute as attribute
          where attribute.attrelid = 'public.users'::regclass
            and attribute.attname = 'active_household_id'
            and not attribute.attisdropped
        )
      ]::smallint[]
      and constraint_record.confkey = array[
        (
          select attribute.attnum
          from pg_catalog.pg_attribute as attribute
          where attribute.attrelid = 'public.households'::regclass
            and attribute.attname = 'id'
            and not attribute.attisdropped
        )
      ]::smallint[]
  ) then
    alter table public.users
      add constraint users_active_household_id_households_id_fk
      foreign key (active_household_id)
      references public.households(id)
      on delete set null;
  end if;
end;
$$;

-- Foreign-key columns are not indexed automatically. This index bounds the
-- referential check/cleanup when a household is deleted and supports
-- operational inspection by active household.
create index if not exists users_active_household_id_idx
  on public.users (active_household_id);

commit;
