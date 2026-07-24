begin;

alter table public.care_entries
  add column if not exists revision integer not null default 1;

alter table public.care_entries
  add constraint care_entries_revision_minimum
  check (revision >= 1);

create or replace function public.enforce_care_entry_revision()
returns trigger
language plpgsql
as $$
begin
  if old.revision = 2147483647 then
    raise exception 'care-entry revision overflow for %', old.id
      using errcode = '22003';
  end if;

  if new.revision = old.revision then
    -- A still-running legacy API does not know about revision. Advance it on
    -- that writer's behalf so a newer client's stale CAS cannot overwrite it.
    new.revision := old.revision + 1;
  elsif new.revision <> old.revision + 1 then
    raise exception 'care-entry revision must advance exactly once from % to %, received %',
      old.revision,
      old.revision + 1,
      new.revision
      using errcode = '40001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_care_entry_revision on public.care_entries;

create trigger enforce_care_entry_revision
before update on public.care_entries
for each row execute function public.enforce_care_entry_revision();

commit;
