-- Persist each Clerk user's selected household. Runtime resolution still
-- verifies current membership and rejects expired Access Pass memberships.
begin;

alter table public.users
  add column if not exists active_household_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_active_household_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_active_household_id_fkey
      foreign key (active_household_id)
      references public.households(id)
      on delete set null;
  end if;
end
$$;

with ranked_memberships as (
  select
    user_id,
    household_id,
    row_number() over (
      partition by user_id
      order by created_at, household_id
    ) as membership_rank
  from public.household_members
)
update public.users as users
set active_household_id = ranked_memberships.household_id
from ranked_memberships
where ranked_memberships.user_id = users.id
  and ranked_memberships.membership_rank = 1
  and users.active_household_id is null;

create index if not exists users_active_household_id_idx
  on public.users(active_household_id);

commit;
