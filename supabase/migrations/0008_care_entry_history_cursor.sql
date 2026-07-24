begin;

alter table public.households
  add column if not exists care_history_generation bigint not null default 0;

-- JavaScript Date and the public cursor contract are millisecond-precise.
-- Normalize legacy microseconds before building the keyset index so every
-- stored ordering value can round-trip through an API cursor without loss.
alter table public.care_entries
  alter column occurred_at type timestamptz(3)
  using occurred_at::timestamptz(3);

create index if not exists care_entries_history_cursor_idx
  on public.care_entries (household_id, occurred_at desc, id desc);

-- Keep the generation boundary authoritative for old and new API writers.
-- A row move changes the complete history of both households, so invalidate
-- OLD and NEW scopes independently.
create or replace function public.advance_care_entry_history_generation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.households
    set care_history_generation = care_history_generation + 1
    where id = new.household_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.households
    set care_history_generation = care_history_generation + 1
    where id = old.household_id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.household_id is distinct from new.household_id then
      update public.households
      set care_history_generation = care_history_generation + 1
      where id = old.household_id;

      update public.households
      set care_history_generation = care_history_generation + 1
      where id = new.household_id;
      return new;
    end if;

    update public.households
    set care_history_generation = care_history_generation + 1
    where id = old.household_id;
    return new;
  end if;

  raise exception 'unsupported care-entry history trigger operation %', tg_op;
end;
$$;

drop trigger if exists advance_care_entry_history_generation
  on public.care_entries;
create trigger advance_care_entry_history_generation
after insert or update or delete on public.care_entries
for each row execute function public.advance_care_entry_history_generation();

commit;
