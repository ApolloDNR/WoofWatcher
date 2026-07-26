begin;

create table public.account_deletion_jobs (
  id uuid primary key,
  user_id text not null,
  state text not null,
  state_generation integer not null default 0,
  deletion_starts_at timestamptz not null default transaction_timestamp(),
  apple_applicable boolean not null,
  active_provider_action_id uuid,
  active_recovery_generation integer,
  recovery_expires_at timestamptz,
  recovery_handoff_generation integer,
  blocked_code text,
  retry_code text,
  retry_resume_state text,
  lease_worker_id text,
  lease_token text,
  lease_until timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint account_deletion_jobs_user_nonblank
    check (btrim(user_id) <> ''),
  constraint account_deletion_jobs_state check (state in (
    'challenge_required', 'reauth_verified', 'provider_action_required',
    'accepted', 'apple_revoking', 'apple_revoked', 'preflight',
    'cleanup_pending', 'cleanup_running', 'object_inventory',
    'object_cleanup_pending', 'object_cleanup_running',
    'object_cleanup_complete', 'clerk_deleting', 'receipt_finalizing',
    'retry_required', 'blocked', 'failed', 'succeeded'
  )),
  constraint account_deletion_jobs_state_generation
    check (state_generation >= 0),
  constraint account_deletion_jobs_blocked_code check (
    blocked_code is null
    or blocked_code in ('last_owner', 'missing_user', 'provider_unavailable')
  ),
  constraint account_deletion_jobs_retry_resume_state check (
    retry_resume_state is null
    or retry_resume_state in (
      'apple_revoking', 'cleanup_pending', 'object_inventory',
      'object_cleanup_running', 'clerk_deleting', 'receipt_finalizing'
    )
  ),
  constraint account_deletion_jobs_retry_correlation check (
    (state = 'retry_required')
      = (retry_resume_state is not null and retry_code is not null)
  ),
  constraint account_deletion_jobs_lease_correlation check (
    (lease_worker_id is null and lease_token is null and lease_until is null)
    or
    (lease_worker_id is not null and lease_token is not null
      and lease_until is not null)
  ),
  constraint account_deletion_jobs_recovery_correlation check (
    (active_recovery_generation is null and recovery_expires_at is null)
    or
    (active_recovery_generation is not null and recovery_expires_at is not null)
  )
);

create table public.account_deletion_provider_actions (
  id uuid primary key,
  request_id uuid not null
    references public.account_deletion_jobs(id) on delete restrict,
  kind text not null,
  generation integer not null,
  client_payload_ciphertext text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  constraint account_deletion_provider_actions_kind check (
    kind in ('clerk_reauthentication', 'apple_reauthorization')
  ),
  constraint account_deletion_provider_actions_generation
    check (generation >= 0),
  unique (request_id, generation)
);

alter table public.account_deletion_jobs
  add constraint account_deletion_jobs_active_provider_action_id_fkey
  foreign key (active_provider_action_id)
  references public.account_deletion_provider_actions(id)
  on delete restrict;

create index account_deletion_provider_actions_request_id_idx
  on public.account_deletion_provider_actions (request_id);

create table public.account_deletion_provider_effects (
  id uuid primary key,
  request_id uuid not null
    references public.account_deletion_jobs(id) on delete restrict,
  kind text not null,
  object_inventory_id uuid,
  replay_key text not null,
  state text not null default 'intent',
  attempt integer not null default 0,
  replay_material_ciphertext text,
  checkpoint_ciphertext text,
  provider_receipt_ciphertext text,
  last_reason_code text,
  committed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint account_deletion_provider_effects_replay_key_key
    unique (replay_key),
  constraint account_deletion_provider_effects_kind check (
    kind in ('apple_revoke', 'object_delete', 'clerk_delete')
  ),
  constraint account_deletion_provider_effects_replay_key
    check (btrim(replay_key) <> ''),
  constraint account_deletion_provider_effects_state check (
    state in (
      'intent', 'claimed', 'checkpointed', 'committed',
      'retry_required', 'indeterminate'
    )
  ),
  constraint account_deletion_provider_effects_attempt check (attempt >= 0),
  constraint account_deletion_effect_object_kind check (
    (kind = 'object_delete' and object_inventory_id is not null)
    or
    (kind <> 'object_delete' and object_inventory_id is null)
  )
);

create index account_deletion_provider_effects_request_kind_idx
  on public.account_deletion_provider_effects (request_id, kind);

create table public.account_deletion_challenges (
  id text primary key,
  user_id text not null,
  purpose text not null,
  raw_proof_binding_sha256 text not null,
  client_hint_envelope_ciphertext text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  constraint account_deletion_challenges_id_nonblank
    check (btrim(id) <> ''),
  constraint account_deletion_challenges_user_nonblank
    check (btrim(user_id) <> ''),
  constraint account_deletion_challenges_purpose
    check (purpose = 'account_deletion'),
  constraint account_deletion_challenges_binding_digest
    check (raw_proof_binding_sha256 ~ '^[0-9a-f]{64}$')
);

create table public.account_deletion_reauth_proof_claims_legacy (
  request_id uuid not null
    references public.account_deletion_jobs(id) on delete restrict,
  proof_id text not null,
  user_id text not null,
  envelope_sha256 text not null,
  consumed_at timestamptz not null default now(),
  primary key (request_id, proof_id)
);

create table public.account_deletion_idempotency (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  operation_id text not null,
  idempotency_key_hash text not null,
  request_fingerprint_sha256 text not null,
  request_id uuid
    references public.account_deletion_jobs(id) on delete restrict,
  encrypted_response_body text not null,
  response_status integer not null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint account_deletion_idempotency_user_nonblank
    check (btrim(user_id) <> ''),
  constraint account_deletion_idempotency_operation_nonblank
    check (btrim(operation_id) <> ''),
  constraint account_deletion_idempotency_key_digest
    check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  constraint account_deletion_idempotency_fingerprint_digest
    check (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  constraint account_deletion_idempotency_response_status
    check (response_status between 100 and 599),
  constraint account_deletion_idempotency_user_operation_key
    unique (user_id, operation_id, idempotency_key_hash)
);

create table public.account_deletion_recovery_token_digests (
  request_id uuid not null
    references public.account_deletion_jobs(id) on delete restrict,
  generation integer not null,
  token_digest_sha256 text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  constraint account_deletion_recovery_token_digest_sha256_key
    unique (token_digest_sha256),
  constraint account_deletion_recovery_token_generation
    check (generation >= 0),
  constraint account_deletion_recovery_token_digest
    check (token_digest_sha256 ~ '^[0-9a-f]{64}$'),
  primary key (request_id, generation)
);

create table public.account_deletion_receipts (
  receipt_id uuid primary key,
  request_id uuid not null unique
    references public.account_deletion_jobs(id) on delete restrict,
  terminal_state text not null,
  data_cleanup_state text not null,
  apple_state text not null,
  clerk_state text not null,
  object_state text not null,
  terminal_code text,
  finalized_at timestamptz not null default transaction_timestamp(),
  constraint account_deletion_receipts_terminal_state
    check (terminal_state in ('blocked', 'failed', 'succeeded')),
  constraint account_deletion_receipts_data_cleanup_state
    check (data_cleanup_state in ('not_started', 'partial', 'complete')),
  constraint account_deletion_receipts_apple_state
    check (apple_state in ('not_applicable', 'revoked', 'unresolved')),
  constraint account_deletion_receipts_clerk_state
    check (clerk_state in ('present', 'deleted', 'already_absent', 'unresolved')),
  constraint account_deletion_receipts_object_state
    check (object_state in ('not_started', 'partial', 'complete'))
);

create function public.account_deletion_guard_job_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.deletion_starts_at is distinct from old.deletion_starts_at
    or new.created_at is distinct from old.created_at
    or new.apple_applicable is distinct from old.apple_applicable
  then
    raise exception 'immutable account deletion job identity/history';
  end if;
  return new;
end;
$$;

create trigger account_deletion_jobs_immutable_fields
before update on public.account_deletion_jobs
for each row execute function public.account_deletion_guard_job_immutability();

create function public.account_deletion_guard_challenge_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.purpose is distinct from old.purpose
    or new.raw_proof_binding_sha256 is distinct
      from old.raw_proof_binding_sha256
    or new.client_hint_envelope_ciphertext is distinct
      from old.client_hint_envelope_ciphertext
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
    or (
      old.consumed_at is not null
      and new.consumed_at is distinct from old.consumed_at
    )
  then
    raise exception 'immutable account deletion challenge history';
  end if;
  return new;
end;
$$;

create trigger account_deletion_challenges_immutable_fields
before update on public.account_deletion_challenges
for each row
execute function public.account_deletion_guard_challenge_immutability();

create function public.account_deletion_guard_effect_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.request_id is distinct from old.request_id
    or new.kind is distinct from old.kind
    or new.object_inventory_id is distinct from old.object_inventory_id
    or new.replay_key is distinct from old.replay_key
    or (
      old.replay_material_ciphertext is not null
      and new.replay_material_ciphertext is distinct
        from old.replay_material_ciphertext
    )
  then
    raise exception 'immutable provider effect identity/replay material';
  end if;
  return new;
end;
$$;

create trigger account_deletion_provider_effects_immutable_fields
before update on public.account_deletion_provider_effects
for each row execute function public.account_deletion_guard_effect_immutability();

create function public.account_deletion_reject_receipt_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'account deletion receipts are immutable';
end;
$$;

create trigger account_deletion_receipts_immutable
before update or delete on public.account_deletion_receipts
for each row execute function public.account_deletion_reject_receipt_change();

alter table public.account_deletion_jobs enable row level security;
alter table public.account_deletion_provider_actions enable row level security;
alter table public.account_deletion_provider_effects enable row level security;
alter table public.account_deletion_challenges enable row level security;
alter table public.account_deletion_reauth_proof_claims_legacy
  enable row level security;
alter table public.account_deletion_idempotency enable row level security;
alter table public.account_deletion_recovery_token_digests
  enable row level security;
alter table public.account_deletion_receipts enable row level security;

revoke all on public.account_deletion_jobs from anon, authenticated;
revoke all on public.account_deletion_provider_actions from anon, authenticated;
revoke all on public.account_deletion_provider_effects from anon, authenticated;
revoke all on public.account_deletion_challenges from anon, authenticated;
revoke all on public.account_deletion_reauth_proof_claims_legacy
  from anon, authenticated;
revoke all on public.account_deletion_idempotency from anon, authenticated;
revoke all on public.account_deletion_recovery_token_digests
  from anon, authenticated;
revoke all on public.account_deletion_receipts from anon, authenticated;

commit;
