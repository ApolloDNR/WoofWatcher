-- Normalize the closed legacy household-role vocabulary before enforcing the
-- canonical role contract. Unknown provider data deliberately fails constraint
-- validation instead of being guessed into authority.
begin;

lock table public.household_members in share row exclusive mode;

update public.household_members as member
set role = case lower(
  btrim(regexp_replace(member.role, '[[:space:]]+', ' ', 'g'))
)
  when 'admin' then 'owner'
  when 'adult admin' then 'owner'
  when 'owner' then 'owner'
  when 'adult' then 'adult'
  when 'member' then 'adult'
  when 'primary caregiver' then 'adult'
  when 'teen' then 'teen'
  when 'kid' then 'kid'
  when 'child' then 'kid'
  when 'minor' then 'kid'
  when 'sitter' then 'sitter'
  when 'helper' then 'sitter'
  when 'temporary helper' then 'sitter'
  when 'trainer' then 'trainer'
  when 'walker' then 'walker'
  when 'viewer' then 'vet viewer'
  when 'vet' then 'vet viewer'
  when 'vet viewer' then 'vet viewer'
  when 'veterinary viewer' then 'vet viewer'
  when 'read-only' then 'vet viewer'
  when 'readonly' then 'vet viewer'
  else member.role
end;

alter table public.household_members
  alter column role set default 'adult';

-- Recreate this repository-owned constraint exactly. A provider-side object
-- with the same name but different semantics must not be mistaken for proof.
alter table public.household_members
  drop constraint if exists household_members_role_canonical_check;

alter table public.household_members
  add constraint household_members_role_canonical_check
  check (role in ('owner', 'adult', 'teen', 'kid', 'sitter', 'trainer', 'walker', 'vet viewer'))
  not valid;

alter table public.household_members
  validate constraint household_members_role_canonical_check;

-- An active pointer is authority only while the exact membership has a
-- canonical role and any access pass remains current at provider time.
update public.users as app_user
set active_household_id = null
where app_user.active_household_id is not null
  and not exists (
    select 1
    from public.household_members as member
    where member.user_id = app_user.id
      and member.household_id = app_user.active_household_id
      and member.role in (
        'owner', 'adult', 'teen', 'kid',
        'sitter', 'trainer', 'walker', 'vet viewer'
      )
      and (
        member.role not in ('sitter', 'trainer', 'walker', 'vet viewer')
        or member.access_pass_expires_at is null
        or member.access_pass_expires_at > statement_timestamp()
      )
  );

-- Repair cleared pointers to the earliest remaining valid membership. Expired
-- helpers and unknown roles can never be selected by this deterministic pass.
with earliest_membership as (
  select distinct on (member.user_id)
    member.user_id,
    member.household_id
  from public.household_members as member
  where member.role in (
      'owner', 'adult', 'teen', 'kid',
      'sitter', 'trainer', 'walker', 'vet viewer'
    )
    and (
      member.role not in ('sitter', 'trainer', 'walker', 'vet viewer')
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

commit;
