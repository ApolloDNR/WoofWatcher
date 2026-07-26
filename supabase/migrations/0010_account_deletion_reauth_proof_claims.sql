begin;

lock table public.account_deletion_reauth_proof_claims_legacy
  in access exclusive mode;

alter table public.account_deletion_provider_effects
  add column if not exists claimed_job_generation integer;

create temporary table account_deletion_0010_context (
  destination_existed boolean not null
) on commit drop;

insert into account_deletion_0010_context (destination_existed)
values (
  to_regclass('public.account_deletion_reauth_proof_claims') is not null
);

do $$
begin
  if exists (
    select 1
    from public.account_deletion_reauth_proof_claims_legacy
    group by proof_id
    having count(*) > 1
  ) then
    raise exception 'duplicate proof_id in legacy proof claims';
  end if;

  if exists (
    select 1
    from public.account_deletion_reauth_proof_claims_legacy source
    left join public.account_deletion_jobs job on job.id = source.request_id
    where job.id is null
  ) then
    raise exception 'orphan request_id in legacy proof claims';
  end if;

  if exists (
    select 1
    from public.account_deletion_reauth_proof_claims_legacy source
    join public.account_deletion_jobs job on job.id = source.request_id
    where job.user_id is distinct from source.user_id
  ) then
    raise exception 'request/user mismatch in legacy proof claims';
  end if;

  if exists (
    select 1
    from public.account_deletion_reauth_proof_claims_legacy
    where btrim(proof_id, E' \t\n\r\f\v') = ''
      or btrim(user_id, E' \t\n\r\f\v') = ''
      or envelope_sha256 !~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'invalid legacy proof claim value';
  end if;
end;
$$;

create table if not exists public.account_deletion_reauth_proof_claims (
  proof_id text primary key,
  request_id uuid not null unique
    references public.account_deletion_jobs(id) on delete restrict,
  user_id text not null,
  envelope_sha256 text not null,
  consumed_at timestamptz not null,
  constraint account_deletion_reauth_proof_claims_proof_nonblank
    check (btrim(proof_id, E' \t\n\r\f\v') <> ''),
  constraint account_deletion_reauth_proof_claims_user_nonblank
    check (btrim(user_id, E' \t\n\r\f\v') <> ''),
  constraint account_deletion_reauth_proof_claims_digest
    check (envelope_sha256 ~ '^[0-9a-f]{64}$')
);

lock table public.account_deletion_reauth_proof_claims
  in access exclusive mode;

do $$
declare
  existed boolean;
begin
  select destination_existed
  into existed
  from account_deletion_0010_context;

  if existed and not exists (
    select 1
    from pg_class relation
    where relation.oid =
      'public.account_deletion_reauth_proof_claims'::regclass
      and relation.relkind = 'r'
      and relation.relpersistence = 'p'
  ) then
    raise exception 'unsafe pre-existing proof claim destination relation';
  end if;

  if existed and exists (
    select 1
    from pg_policy policy_record
    where policy_record.polrelid =
      'public.account_deletion_reauth_proof_claims'::regclass
  ) then
    raise exception 'unsafe pre-existing proof claim destination policies';
  end if;

  if existed and exists (
    select 1
    from pg_trigger trigger_record
    join pg_proc function_record
      on function_record.oid = trigger_record.tgfoid
    join pg_namespace function_namespace
      on function_namespace.oid = function_record.pronamespace
    where trigger_record.tgrelid =
      'public.account_deletion_reauth_proof_claims'::regclass
      and not trigger_record.tgisinternal
      and not (
        trigger_record.tgenabled = 'O'
        and trigger_record.tgnargs = 0
        and trigger_record.tgattr::text = ''
        and trigger_record.tgqual is null
        and trigger_record.tgoldtable is null
        and trigger_record.tgnewtable is null
        and function_namespace.nspname = 'public'
        and pg_get_function_identity_arguments(function_record.oid) = ''
        and (
          (
            trigger_record.tgname =
              'account_deletion_reauth_proof_claims_immutable'
            and trigger_record.tgtype = 27
            and function_record.proname =
              'account_deletion_reject_proof_claim_change'
          )
          or
          (
            trigger_record.tgname =
              'account_deletion_reauth_proof_claims_no_erasure'
            and trigger_record.tgtype = 42
            and function_record.proname =
              'account_deletion_reject_history_erasure'
          )
        )
      )
  ) then
    raise exception 'unsafe pre-existing proof claim destination triggers';
  end if;

  if existed and exists (
    with expected_columns(
      column_name, data_type, is_not_null, has_default
    ) as (
      values
        ('proof_id'::name, 'text'::text, true, false),
        ('request_id'::name, 'uuid'::text, true, false),
        ('user_id'::name, 'text'::text, true, false),
        ('envelope_sha256'::name, 'text'::text, true, false),
        (
          'consumed_at'::name, 'timestamp with time zone'::text,
          true, false
        )
    ),
    actual_columns as (
      select attribute.attname as column_name,
             format_type(attribute.atttypid, attribute.atttypmod) as data_type,
             attribute.attnotnull as is_not_null,
             default_record.oid is not null as has_default
      from pg_attribute attribute
      left join pg_attrdef default_record
        on default_record.adrelid = attribute.attrelid
        and default_record.adnum = attribute.attnum
      where attribute.attrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and attribute.attnum > 0
        and not attribute.attisdropped
    )
    select 1
    from expected_columns expected
    full join actual_columns actual using (column_name)
    where expected.column_name is null
      or actual.column_name is null
      or expected.data_type is distinct from actual.data_type
      or expected.is_not_null is distinct from actual.is_not_null
      or expected.has_default is distinct from actual.has_default
  ) then
    raise exception 'unsafe pre-existing proof claim destination columns';
  end if;

  if existed and (
    (
      select count(*)
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and constraint_record.contype in ('p', 'u', 'f', 'c', 'x')
    ) <> 6
    or not exists (
      select 1
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and constraint_record.conname =
          'account_deletion_reauth_proof_claims_pkey'
        and constraint_record.contype = 'p'
        and constraint_record.convalidated
        and pg_get_constraintdef(constraint_record.oid) =
          'PRIMARY KEY (proof_id)'
    )
    or not exists (
      select 1
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and constraint_record.conname =
          'account_deletion_reauth_proof_claims_request_id_key'
        and constraint_record.contype = 'u'
        and constraint_record.convalidated
        and pg_get_constraintdef(constraint_record.oid) =
          'UNIQUE (request_id)'
    )
    or not exists (
      select 1
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and constraint_record.conname =
          'account_deletion_reauth_proof_claims_request_id_fkey'
        and constraint_record.contype = 'f'
        and constraint_record.convalidated
        and constraint_record.confrelid =
          'public.account_deletion_jobs'::regclass
        and constraint_record.confdeltype = 'r'
        and pg_get_constraintdef(constraint_record.oid) =
          'FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT'
    )
    or not exists (
      select 1
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and constraint_record.conname =
          'account_deletion_reauth_proof_claims_proof_nonblank'
        and constraint_record.contype = 'c'
        and constraint_record.convalidated
        and pg_get_constraintdef(constraint_record.oid) =
          E'CHECK ((btrim(proof_id, '' \t\n\r\f\v''::text) <> ''''::text))'
    )
    or not exists (
      select 1
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and constraint_record.conname =
          'account_deletion_reauth_proof_claims_user_nonblank'
        and constraint_record.contype = 'c'
        and constraint_record.convalidated
        and pg_get_constraintdef(constraint_record.oid) =
          E'CHECK ((btrim(user_id, '' \t\n\r\f\v''::text) <> ''''::text))'
    )
    or not exists (
      select 1
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
        and constraint_record.conname =
          'account_deletion_reauth_proof_claims_digest'
        and constraint_record.contype = 'c'
        and constraint_record.convalidated
        and pg_get_constraintdef(constraint_record.oid) =
          'CHECK ((envelope_sha256 ~ ''^[0-9a-f]{64}$''::text))'
    )
  ) then
    raise exception 'unsafe pre-existing proof claim destination constraints';
  end if;

  if existed and (
    exists (
      select proof_id, request_id, user_id, envelope_sha256, consumed_at
      from public.account_deletion_reauth_proof_claims_legacy
      except
      select proof_id, request_id, user_id, envelope_sha256, consumed_at
      from public.account_deletion_reauth_proof_claims
    )
    or exists (
      select proof_id, request_id, user_id, envelope_sha256, consumed_at
      from public.account_deletion_reauth_proof_claims
      except
      select proof_id, request_id, user_id, envelope_sha256, consumed_at
      from public.account_deletion_reauth_proof_claims_legacy
    )
  ) then
    raise exception 'pre-existing proof claim destination mismatch';
  end if;

  if not existed then
    insert into public.account_deletion_reauth_proof_claims (
      proof_id, request_id, user_id, envelope_sha256, consumed_at
    )
    select proof_id, request_id, user_id, envelope_sha256, consumed_at
    from public.account_deletion_reauth_proof_claims_legacy;
  end if;
end;
$$;

do $$
declare
  source_count bigint;
  destination_count bigint;
  source_digest text;
  destination_digest text;
begin
  select count(*),
         md5(coalesce(string_agg(to_jsonb(source_row)::text, E'\n'
           order by proof_id, request_id), ''))
  into source_count, source_digest
  from (
    select proof_id, request_id, user_id, envelope_sha256, consumed_at
    from public.account_deletion_reauth_proof_claims_legacy
  ) source_row;

  select count(*),
         md5(coalesce(string_agg(to_jsonb(destination_row)::text, E'\n'
           order by proof_id, request_id), ''))
  into destination_count, destination_digest
  from (
    select proof_id, request_id, user_id, envelope_sha256, consumed_at
    from public.account_deletion_reauth_proof_claims
  ) destination_row;

  if source_count <> destination_count
    or source_digest is distinct from destination_digest
  then
    raise exception 'proof claim backfill verification mismatch';
  end if;
end;
$$;

create or replace function public.account_deletion_reject_legacy_proof_write()
returns trigger
language plpgsql
as $$
begin
  raise exception 'legacy proof claims are read-only';
end;
$$;

drop trigger if exists account_deletion_reauth_proof_claims_legacy_read_only
  on public.account_deletion_reauth_proof_claims_legacy;
create trigger account_deletion_reauth_proof_claims_legacy_read_only
before insert or update or delete
on public.account_deletion_reauth_proof_claims_legacy
for each row
execute function public.account_deletion_reject_legacy_proof_write();

create or replace function public.account_deletion_reject_proof_claim_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'proof claims are immutable';
end;
$$;

drop trigger if exists account_deletion_reauth_proof_claims_immutable
  on public.account_deletion_reauth_proof_claims;
create trigger account_deletion_reauth_proof_claims_immutable
before update or delete
on public.account_deletion_reauth_proof_claims
for each row
execute function public.account_deletion_reject_proof_claim_change();

create or replace function public.account_deletion_guard_provider_action_history()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.request_id is distinct from old.request_id
    or new.kind is distinct from old.kind
    or new.generation is distinct from old.generation
    or new.client_payload_ciphertext is distinct
      from old.client_payload_ciphertext
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
    or (
      old.consumed_at is not null
      and new.consumed_at is distinct from old.consumed_at
    )
  then
    raise exception 'immutable provider action history';
  end if;
  return new;
end;
$$;

drop trigger if exists account_deletion_provider_actions_immutable_fields
  on public.account_deletion_provider_actions;
create trigger account_deletion_provider_actions_immutable_fields
before update on public.account_deletion_provider_actions
for each row
execute function public.account_deletion_guard_provider_action_history();

create or replace function public.account_deletion_guard_effect_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.request_id is distinct from old.request_id
    or new.kind is distinct from old.kind
    or new.object_inventory_id is distinct from old.object_inventory_id
    or new.replay_key is distinct from old.replay_key
    or new.created_at is distinct from old.created_at
    or (
      old.replay_material_ciphertext is not null
      and new.replay_material_ciphertext is distinct
        from old.replay_material_ciphertext
    )
    or (
      old.provider_receipt_ciphertext is not null
      and new.provider_receipt_ciphertext is distinct
        from old.provider_receipt_ciphertext
    )
    or (
      old.committed_at is not null
      and new.committed_at is distinct from old.committed_at
    )
  then
    raise exception 'immutable provider effect identity/history';
  end if;
  return new;
end;
$$;

create or replace function public.account_deletion_reject_idempotency_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'account deletion idempotency history is immutable';
end;
$$;

drop trigger if exists account_deletion_idempotency_immutable
  on public.account_deletion_idempotency;
create trigger account_deletion_idempotency_immutable
before update on public.account_deletion_idempotency
for each row
execute function public.account_deletion_reject_idempotency_change();

create or replace function public.account_deletion_guard_recovery_history()
returns trigger
language plpgsql
as $$
begin
  if new.request_id is distinct from old.request_id
    or new.generation is distinct from old.generation
    or new.token_digest_sha256 is distinct from old.token_digest_sha256
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
    or (
      old.consumed_at is not null
      and new.consumed_at is distinct from old.consumed_at
    )
  then
    raise exception 'immutable account deletion recovery history';
  end if;
  return new;
end;
$$;

drop trigger if exists account_deletion_recovery_token_digests_immutable_fields
  on public.account_deletion_recovery_token_digests;
create trigger account_deletion_recovery_token_digests_immutable_fields
before update on public.account_deletion_recovery_token_digests
for each row
execute function public.account_deletion_guard_recovery_history();

create or replace function public.account_deletion_reject_history_erasure()
returns trigger
language plpgsql
as $$
begin
  raise exception 'account deletion history cannot be erased';
end;
$$;

drop trigger if exists account_deletion_jobs_no_erasure
  on public.account_deletion_jobs;
create trigger account_deletion_jobs_no_erasure
before delete or truncate on public.account_deletion_jobs
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_provider_actions_no_erasure
  on public.account_deletion_provider_actions;
create trigger account_deletion_provider_actions_no_erasure
before delete or truncate on public.account_deletion_provider_actions
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_provider_effects_no_erasure
  on public.account_deletion_provider_effects;
create trigger account_deletion_provider_effects_no_erasure
before delete or truncate on public.account_deletion_provider_effects
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_challenges_no_erasure
  on public.account_deletion_challenges;
create trigger account_deletion_challenges_no_erasure
before delete or truncate on public.account_deletion_challenges
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_reauth_proof_claims_legacy_no_erasure
  on public.account_deletion_reauth_proof_claims_legacy;
create trigger account_deletion_reauth_proof_claims_legacy_no_erasure
before delete or truncate
on public.account_deletion_reauth_proof_claims_legacy
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_reauth_proof_claims_no_erasure
  on public.account_deletion_reauth_proof_claims;
create trigger account_deletion_reauth_proof_claims_no_erasure
before delete or truncate on public.account_deletion_reauth_proof_claims
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_idempotency_no_erasure
  on public.account_deletion_idempotency;
create trigger account_deletion_idempotency_no_erasure
before delete or truncate on public.account_deletion_idempotency
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_recovery_token_digests_no_erasure
  on public.account_deletion_recovery_token_digests;
create trigger account_deletion_recovery_token_digests_no_erasure
before delete or truncate
on public.account_deletion_recovery_token_digests
for each statement
execute function public.account_deletion_reject_history_erasure();

drop trigger if exists account_deletion_receipts_no_erasure
  on public.account_deletion_receipts;
create trigger account_deletion_receipts_no_erasure
before delete or truncate on public.account_deletion_receipts
for each statement
execute function public.account_deletion_reject_history_erasure();

alter table public.account_deletion_reauth_proof_claims_legacy
  enable row level security;
alter table public.account_deletion_reauth_proof_claims
  enable row level security;

revoke all on public.account_deletion_jobs from public;
revoke all on public.account_deletion_provider_actions from public;
revoke all on public.account_deletion_provider_effects from public;
revoke all on public.account_deletion_challenges from public;
revoke all on public.account_deletion_idempotency from public;
revoke all on public.account_deletion_recovery_token_digests from public;
revoke all on public.account_deletion_receipts from public;
revoke all on public.account_deletion_reauth_proof_claims_legacy
  from public, anon, authenticated;
revoke all on public.account_deletion_reauth_proof_claims
  from public, anon, authenticated;

commit;
