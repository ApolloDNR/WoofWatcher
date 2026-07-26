import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration0009 = readFileSync(
  new URL(
    "../../../supabase/migrations/0009_account_deletion_protocol.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration0010 = readFileSync(
  new URL(
    "../../../supabase/migrations/0010_account_deletion_reauth_proof_claims.sql",
    import.meta.url,
  ),
  "utf8",
);

const REQUEST_A = "11111111-1111-4111-8111-111111111111";
const REQUEST_B = "22222222-2222-4222-8222-222222222222";
const REQUEST_C = "33333333-3333-4333-8333-333333333333";
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

async function createDatabase(input?: {
  seedClientDefaultGrants?: boolean;
  seedPublicDefaultGrant?: boolean;
}) {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create table public.users (id text primary key);
    insert into public.users (id) values ('user-a'), ('user-b');
    ${
      input?.seedClientDefaultGrants
        ? `
          alter default privileges in schema public
            grant select, insert, update, delete, truncate, references, trigger
            on tables to anon, authenticated;
        `
        : ""
    }
    ${
      input?.seedPublicDefaultGrant
        ? `
          alter default privileges in schema public
            grant select on tables to public;
        `
        : ""
    }
  `);
  await db.exec(migration0009);
  return db;
}

async function seedJob(db: PGlite, requestId: string, userId: string) {
  await db.query(
    `
      insert into public.account_deletion_jobs
        (id, user_id, state, state_generation, deletion_starts_at,
         apple_applicable)
      values ($1, $2, 'challenge_required', 0,
              '2026-07-25T12:00:00.123Z', false)
    `,
    [requestId, userId],
  );
}

async function seedValidLegacy(db: PGlite) {
  await seedJob(db, REQUEST_A, "user-a");
  await seedJob(db, REQUEST_B, "user-b");
  await db.query(
    `
      insert into public.account_deletion_reauth_proof_claims_legacy
        (request_id, proof_id, user_id, envelope_sha256, consumed_at)
      values
        ($1, 'Proof-Exact-A', 'user-a', $2,
         '2026-07-25T12:01:02.123456Z'),
        ($3, 'Proof-Exact-B', 'user-b', $4,
         '2026-07-25T12:02:03.654321Z')
    `,
    [REQUEST_A, SHA_A, REQUEST_B, SHA_B],
  );
}

async function destinationExists(db: PGlite) {
  const result = await db.query<{ name: string | null }>(
    `select to_regclass('public.account_deletion_reauth_proof_claims')::text as name`,
  );
  return result.rows[0]?.name ?? null;
}

async function assertAtomicFailure(db: PGlite, beforeCount: number) {
  await assert.rejects(db.exec(migration0010));
  await db.exec("rollback");
  assert.equal(await destinationExists(db), null);
  const after = await db.query<{ count: number }>(
    `select count(*)::int as count from public.account_deletion_reauth_proof_claims_legacy`,
  );
  assert.equal(after.rows[0]?.count, beforeCount);
  await seedJob(db, REQUEST_C, "user-a");
  await db.query(
    `
      insert into public.account_deletion_reauth_proof_claims_legacy
        (request_id, proof_id, user_id, envelope_sha256)
      values ($1, 'proof-source-still-writable', 'user-a', $2)
    `,
    [REQUEST_C, SHA_A],
  );
}

async function assertRejectedStatement(db: PGlite, statement: string) {
  await db.exec("begin");
  let rejected = false;
  try {
    await db.exec(statement);
  } catch {
    rejected = true;
  }
  await db.exec("rollback");
  assert.equal(
    rejected,
    true,
    `statement unexpectedly succeeded: ${statement}`,
  );
}

test("0010 rejects duplicate global proof IDs atomically and leaves legacy writable", async () => {
  const db = await createDatabase();
  try {
    await seedJob(db, REQUEST_A, "user-a");
    await seedJob(db, REQUEST_B, "user-b");
    await db.query(
      `
        insert into public.account_deletion_reauth_proof_claims_legacy
          (request_id, proof_id, user_id, envelope_sha256)
        values ($1, 'proof-duplicate', 'user-a', $2),
               ($3, 'proof-duplicate', 'user-b', $4)
      `,
      [REQUEST_A, SHA_A, REQUEST_B, SHA_B],
    );
    await assertAtomicFailure(db, 2);
  } finally {
    await db.close();
  }
});

test("0010 rejects deliberately orphaned and request/user-mismatched legacy rows atomically", async () => {
  for (const kind of ["orphan", "user_mismatch"] as const) {
    const db = await createDatabase();
    try {
      await seedJob(db, REQUEST_A, "user-a");
      if (kind === "orphan") {
        await db.exec(`
          alter table public.account_deletion_reauth_proof_claims_legacy
            drop constraint account_deletion_reauth_proof_claims_legacy_request_id_fkey;
        `);
        await db.query(
          `
            insert into public.account_deletion_reauth_proof_claims_legacy
              (request_id, proof_id, user_id, envelope_sha256)
            values ($1, 'proof-orphan', 'user-a', $2)
          `,
          [REQUEST_B, SHA_A],
        );
      } else {
        await db.query(
          `
            insert into public.account_deletion_reauth_proof_claims_legacy
              (request_id, proof_id, user_id, envelope_sha256)
            values ($1, 'proof-mismatch', 'user-b', $2)
          `,
          [REQUEST_A, SHA_A],
        );
      }
      await assertAtomicFailure(db, 1);
    } finally {
      await db.close();
    }
  }
});

test("0010 rejects malformed digests and blank or whitespace proof/user IDs atomically", async () => {
  const cases = [
    { proofId: "proof-a", userId: "user-a", digest: "A".repeat(64) },
    { proofId: "proof-a", userId: "user-a", digest: "a".repeat(63) },
    { proofId: "", userId: "user-a", digest: SHA_A },
    { proofId: " \t", userId: "user-a", digest: SHA_A },
    { proofId: "proof-a", userId: "", digest: SHA_A },
    { proofId: "proof-a", userId: " \n", digest: SHA_A },
  ];
  for (const [index, fixture] of cases.entries()) {
    const db = await createDatabase();
    try {
      await seedJob(db, REQUEST_A, fixture.userId || "user-a");
      await db.query(
        `
          insert into public.account_deletion_reauth_proof_claims_legacy
            (request_id, proof_id, user_id, envelope_sha256)
          values ($1, $2, $3, $4)
        `,
        [REQUEST_A, fixture.proofId, fixture.userId, fixture.digest],
      );
      await assertAtomicFailure(db, 1);
    } finally {
      await db.close();
    }
    assert.ok(index >= 0);
  }
});

test("valid 0010 backfill is exact, rerunnable, globally unique, restrictive, and disables legacy writes", async () => {
  const db = await createDatabase();
  try {
    await seedValidLegacy(db);
    await db.exec(migration0010);

    const difference = await db.query<{ side: string }>(`
      (
        select 'source_minus_destination' as side
        from (
          select proof_id, request_id, user_id, envelope_sha256, consumed_at
          from public.account_deletion_reauth_proof_claims_legacy
          except
          select proof_id, request_id, user_id, envelope_sha256, consumed_at
          from public.account_deletion_reauth_proof_claims
        ) source_difference
      )
      union all
      (
        select 'destination_minus_source' as side
        from (
          select proof_id, request_id, user_id, envelope_sha256, consumed_at
          from public.account_deletion_reauth_proof_claims
          except
          select proof_id, request_id, user_id, envelope_sha256, consumed_at
          from public.account_deletion_reauth_proof_claims_legacy
        ) destination_difference
      )
    `);
    assert.deepEqual(difference.rows, []);
    const exact = await db.query<{
      proofId: string;
      consumedAt: string;
    }>(`
      select proof_id as "proofId",
             (consumed_at at time zone 'UTC')::text as "consumedAt"
      from public.account_deletion_reauth_proof_claims
      order by proof_id
    `);
    assert.deepEqual(exact.rows, [
      {
        proofId: "Proof-Exact-A",
        consumedAt: "2026-07-25 12:01:02.123456",
      },
      {
        proofId: "Proof-Exact-B",
        consumedAt: "2026-07-25 12:02:03.654321",
      },
    ]);

    await db.exec(migration0010);
    const catalog = await db.query<{
      primaryKeys: number;
      uniqueRequest: number;
      restrictiveForeignKeys: number;
      rejectingTriggers: number;
    }>(`
      select
        count(*) filter (where constraint_record.contype = 'p')::int
          as "primaryKeys",
        count(*) filter (
          where constraint_record.contype = 'u'
            and pg_get_constraintdef(constraint_record.oid)
              = 'UNIQUE (request_id)'
        )::int as "uniqueRequest",
        count(*) filter (
          where constraint_record.contype = 'f'
            and constraint_record.confdeltype = 'r'
        )::int as "restrictiveForeignKeys",
        (
          select count(*)::int
          from pg_trigger
          where tgrelid =
            'public.account_deletion_reauth_proof_claims_legacy'::regclass
            and not tgisinternal
        ) as "rejectingTriggers"
      from pg_constraint constraint_record
      where constraint_record.conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
    `);
    assert.deepEqual(catalog.rows, [
      {
        primaryKeys: 1,
        uniqueRequest: 1,
        restrictiveForeignKeys: 1,
        rejectingTriggers: 2,
      },
    ]);
    await assert.rejects(
      db.query(
        `
          insert into public.account_deletion_reauth_proof_claims_legacy
            (request_id, proof_id, user_id, envelope_sha256)
          values ($1, 'future-write', 'user-a', $2)
        `,
        [REQUEST_A, SHA_A],
      ),
    );
  } finally {
    await db.close();
  }
});

test("0010 aborts a pre-existing destination mismatch without changing legacy history", async () => {
  const db = await createDatabase();
  try {
    await seedValidLegacy(db);
    await db.exec(migration0010);
    await db.exec(`
      alter table public.account_deletion_reauth_proof_claims
        disable trigger account_deletion_reauth_proof_claims_immutable;
      update public.account_deletion_reauth_proof_claims
      set envelope_sha256 = '${"c".repeat(64)}'
      where proof_id = 'Proof-Exact-A';
      alter table public.account_deletion_reauth_proof_claims
        enable trigger account_deletion_reauth_proof_claims_immutable;
    `);
    await assert.rejects(db.exec(migration0010));
    await db.exec("rollback");
    const source = await db.query<{ digest: string }>(`
      select envelope_sha256 as digest
      from public.account_deletion_reauth_proof_claims_legacy
      where proof_id = 'Proof-Exact-A'
    `);
    const destination = await db.query<{ digest: string }>(`
      select envelope_sha256 as digest
      from public.account_deletion_reauth_proof_claims
      where proof_id = 'Proof-Exact-A'
    `);
    assert.deepEqual(source.rows, [{ digest: SHA_A }]);
    assert.deepEqual(destination.rows, [{ digest: "c".repeat(64) }]);
  } finally {
    await db.close();
  }
});

test("0010 rejects a matching-data pre-existing destination with unsafe catalog structure", async () => {
  const db = await createDatabase();
  try {
    await seedValidLegacy(db);
    await db.exec(`
      create table public.account_deletion_reauth_proof_claims (
        proof_id text,
        request_id uuid,
        user_id text,
        envelope_sha256 text,
        consumed_at timestamptz
      );
      insert into public.account_deletion_reauth_proof_claims
        (proof_id, request_id, user_id, envelope_sha256, consumed_at)
      select proof_id, request_id, user_id, envelope_sha256, consumed_at
      from public.account_deletion_reauth_proof_claims_legacy;
    `);
    await assert.rejects(db.exec(migration0010));
    await db.exec("rollback");
    const constraints = await db.query<{ count: number }>(`
      select count(*)::int as count
      from pg_constraint
      where conrelid =
        'public.account_deletion_reauth_proof_claims'::regclass
    `);
    assert.deepEqual(constraints.rows, [{ count: 0 }]);
  } finally {
    await db.close();
  }
});

test("0010 rejects a pre-existing destination with a PUBLIC policy or unexpected trigger", async () => {
  for (const hostileArtifact of ["policy", "trigger"] as const) {
    const db = await createDatabase();
    try {
      await seedValidLegacy(db);
      await db.exec(migration0010);
      if (hostileArtifact === "policy") {
        await db.exec(`
          create policy hostile_public_proof_read
          on public.account_deletion_reauth_proof_claims
          for select to public
          using (true);
          grant select
          on public.account_deletion_reauth_proof_claims
          to public;
        `);
        await db.exec("begin; set role anon;");
        try {
          const exposed = await db.query<{ count: number }>(`
            select count(*)::int as count
            from public.account_deletion_reauth_proof_claims
          `);
          assert.deepEqual(exposed.rows, [{ count: 2 }]);
        } finally {
          await db.exec("rollback");
        }
      } else {
        await db.exec(`
          create function public.hostile_proof_trigger()
          returns trigger
          language plpgsql
          as $$
          begin
            return new;
          end;
          $$;
          create trigger hostile_proof_trigger
          before insert on public.account_deletion_reauth_proof_claims
          for each row
          execute function public.hostile_proof_trigger();
        `);
      }

      let rejected = false;
      try {
        await db.exec(migration0010);
      } catch {
        rejected = true;
        await db.exec("rollback");
      }
      assert.equal(
        rejected,
        true,
        `0010 accepted hostile pre-existing ${hostileArtifact}`,
      );
      const retained = await db.query<{ count: number }>(
        hostileArtifact === "policy"
          ? `
            select count(*)::int as count
            from pg_policy
            where polrelid =
              'public.account_deletion_reauth_proof_claims'::regclass
              and polname = 'hostile_public_proof_read'
          `
          : `
            select count(*)::int as count
            from pg_trigger
            where tgrelid =
              'public.account_deletion_reauth_proof_claims'::regclass
              and tgname = 'hostile_proof_trigger'
              and not tgisinternal
          `,
      );
      assert.deepEqual(retained.rows, [{ count: 1 }]);
    } finally {
      await db.close();
    }
  }
});

test("0010 revokes default PUBLIC SELECT from every deletion table and effective anon reads are denied", async () => {
  const db = await createDatabase({ seedPublicDefaultGrant: true });
  try {
    const exposedBefore0010 = await db.query<{ tableName: string }>(`
      select relation.relname as "tableName"
      from pg_class relation
      where relation.relnamespace = 'public'::regnamespace
        and relation.relkind = 'r'
        and relation.relname like 'account_deletion%'
        and has_table_privilege(
          'anon',
          format('public.%I', relation.relname),
          'SELECT'
        )
      order by relation.relname
    `);
    assert.deepEqual(exposedBefore0010.rows, [
      { tableName: "account_deletion_challenges" },
      { tableName: "account_deletion_idempotency" },
      { tableName: "account_deletion_jobs" },
      { tableName: "account_deletion_provider_actions" },
      { tableName: "account_deletion_provider_effects" },
      { tableName: "account_deletion_reauth_proof_claims_legacy" },
      { tableName: "account_deletion_receipts" },
      { tableName: "account_deletion_recovery_token_digests" },
    ]);

    await seedValidLegacy(db);
    await db.exec(migration0010);

    const exposedAfter0010 = await db.query<{ tableName: string }>(`
      select relation.relname as "tableName"
      from pg_class relation
      where relation.relnamespace = 'public'::regnamespace
        and relation.relkind = 'r'
        and relation.relname like 'account_deletion%'
        and has_table_privilege(
          'anon',
          format('public.%I', relation.relname),
          'SELECT'
        )
      order by relation.relname
    `);
    assert.deepEqual(exposedAfter0010.rows, []);

    const protectedTables = [
      "account_deletion_challenges",
      "account_deletion_idempotency",
      "account_deletion_jobs",
      "account_deletion_provider_actions",
      "account_deletion_provider_effects",
      "account_deletion_reauth_proof_claims",
      "account_deletion_reauth_proof_claims_legacy",
      "account_deletion_receipts",
      "account_deletion_recovery_token_digests",
    ];
    for (const tableName of protectedTables) {
      await db.exec("begin; set role anon;");
      try {
        const activeRole = await db.query<{ currentUser: string }>(`
          select current_user as "currentUser"
        `);
        assert.deepEqual(activeRole.rows, [{ currentUser: "anon" }]);
        await assert.rejects(
          db.query(`select * from public.${tableName} limit 1`),
          `anon unexpectedly read public.${tableName}`,
        );
      } finally {
        await db.exec("rollback");
      }
    }
  } finally {
    await db.close();
  }
});

test("0010 makes protocol history immutable, consumption/material one-way, and every history table non-truncatable", async () => {
  const db = await createDatabase();
  try {
    await seedValidLegacy(db);
    await db.exec(`
      insert into public.account_deletion_challenges
        (id, user_id, purpose, raw_proof_binding_sha256,
         client_hint_envelope_ciphertext, expires_at)
      values
        ('challenge-history', 'user-a', 'account_deletion', '${SHA_A}',
         'encrypted-hint', '2026-07-26T00:00:00Z');
      insert into public.account_deletion_provider_actions
        (id, request_id, kind, generation, client_payload_ciphertext,
         expires_at)
      values
        ('44444444-4444-4444-8444-444444444444', '${REQUEST_A}',
         'clerk_reauthentication', 0, 'encrypted-action',
         '2026-07-26T00:00:00Z');
      insert into public.account_deletion_provider_effects
        (id, request_id, kind, replay_key, state)
      values
        ('55555555-5555-4555-8555-555555555555', '${REQUEST_A}',
         'apple_revoke', 'replay-history', 'intent');
      insert into public.account_deletion_idempotency
        (id, user_id, operation_id, idempotency_key_hash,
         request_fingerprint_sha256, request_id,
         encrypted_response_body, response_status)
      values
        ('66666666-6666-4666-8666-666666666666', 'user-a', 'request',
         '${SHA_A}', '${SHA_B}', '${REQUEST_A}', 'encrypted-response', 202);
      insert into public.account_deletion_recovery_token_digests
        (request_id, generation, token_digest_sha256, expires_at)
      values
        ('${REQUEST_A}', 1, '${"c".repeat(64)}',
         '2026-07-26T00:00:00Z');
      insert into public.account_deletion_receipts
        (receipt_id, request_id, terminal_state, data_cleanup_state,
         apple_state, clerk_state, object_state, terminal_code)
      values
        ('77777777-7777-4777-8777-777777777777', '${REQUEST_B}',
         'blocked', 'not_started', 'unresolved', 'present', 'not_started',
         'last_owner');
    `);
    await db.exec(migration0010);

    await db.exec(`
      update public.account_deletion_provider_actions
      set consumed_at = '2026-07-25T13:00:00Z'
      where id = '44444444-4444-4444-8444-444444444444';
      update public.account_deletion_challenges
      set consumed_at = '2026-07-25T13:00:00Z'
      where id = 'challenge-history';
      update public.account_deletion_recovery_token_digests
      set consumed_at = '2026-07-25T13:00:00Z'
      where request_id = '${REQUEST_A}' and generation = 1;
      update public.account_deletion_provider_effects
      set replay_material_ciphertext = 'encrypted-material',
          provider_receipt_ciphertext = 'encrypted-receipt',
          committed_at = '2026-07-25T13:00:00Z'
      where id = '55555555-5555-4555-8555-555555555555';
    `);

    for (const statement of [
      `update public.account_deletion_provider_actions
       set client_payload_ciphertext = 'changed'
       where id = '44444444-4444-4444-8444-444444444444'`,
      `update public.account_deletion_provider_actions
       set consumed_at = null
       where id = '44444444-4444-4444-8444-444444444444'`,
      `update public.account_deletion_challenges
       set consumed_at = null where id = 'challenge-history'`,
      `update public.account_deletion_provider_effects
       set replay_material_ciphertext = 'changed'
       where id = '55555555-5555-4555-8555-555555555555'`,
      `update public.account_deletion_provider_effects
       set provider_receipt_ciphertext = 'changed'
       where id = '55555555-5555-4555-8555-555555555555'`,
      `update public.account_deletion_provider_effects
       set committed_at = '2026-07-25T14:00:00Z'
       where id = '55555555-5555-4555-8555-555555555555'`,
      `update public.account_deletion_provider_effects
       set created_at = created_at + interval '1 second'
       where id = '55555555-5555-4555-8555-555555555555'`,
      `update public.account_deletion_idempotency
       set encrypted_response_body = 'changed'
       where id = '66666666-6666-4666-8666-666666666666'`,
      `update public.account_deletion_recovery_token_digests
       set consumed_at = null
       where request_id = '${REQUEST_A}' and generation = 1`,
      `update public.account_deletion_receipts
       set terminal_code = 'changed'
       where receipt_id = '77777777-7777-4777-8777-777777777777'`,
      `update public.account_deletion_reauth_proof_claims_legacy
       set envelope_sha256 = '${"d".repeat(64)}'
       where proof_id = 'Proof-Exact-A'`,
      `update public.account_deletion_reauth_proof_claims
       set envelope_sha256 = '${"d".repeat(64)}'
       where proof_id = 'Proof-Exact-A'`,
    ]) {
      await assertRejectedStatement(db, statement);
    }

    for (const table of [
      "account_deletion_provider_actions",
      "account_deletion_provider_effects",
      "account_deletion_challenges",
      "account_deletion_reauth_proof_claims_legacy",
      "account_deletion_reauth_proof_claims",
      "account_deletion_idempotency",
      "account_deletion_recovery_token_digests",
      "account_deletion_receipts",
    ]) {
      await assertRejectedStatement(db, `delete from public.${table}`);
      await assertRejectedStatement(
        db,
        `truncate table public.${table} cascade`,
      );
    }
  } finally {
    await db.close();
  }
});

test("seeded default client grants are revoked for every table and privilege", async () => {
  const db = await createDatabase({ seedClientDefaultGrants: true });
  try {
    await seedValidLegacy(db);
    await db.exec(migration0010);
    const access = await db.query<{
      roleName: string;
      tableName: string;
      privilegeName: string;
      allowed: boolean;
    }>(`
      select role_name as "roleName",
             table_name as "tableName",
             privilege_name as "privilegeName",
             has_table_privilege(
               role_name,
               format('public.%I', table_name),
               privilege_name
             ) as allowed
      from unnest(array['anon', 'authenticated']) role_name
      cross join unnest(array[
        'account_deletion_jobs',
        'account_deletion_provider_actions',
        'account_deletion_provider_effects',
        'account_deletion_challenges',
        'account_deletion_reauth_proof_claims_legacy',
        'account_deletion_reauth_proof_claims',
        'account_deletion_idempotency',
        'account_deletion_recovery_token_digests',
        'account_deletion_receipts'
      ]) table_name
      cross join unnest(array[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE',
        'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ]) privilege_name
      order by role_name, table_name, privilege_name
    `);
    assert.equal(access.rows.length, 126);
    assert.equal(
      access.rows.every((row) => row.allowed === false),
      true,
    );
  } finally {
    await db.close();
  }
});

test("every protocol foreign key exists explicitly and uses restrictive deletion", async () => {
  const db = await createDatabase();
  try {
    await seedValidLegacy(db);
    await db.exec(migration0010);
    const foreignKeys = await db.query<{
      tableName: string;
      name: string;
      definition: string;
      deleteAction: string;
    }>(`
      select relation.relname as "tableName",
             constraint_record.conname as name,
             pg_get_constraintdef(constraint_record.oid) as definition,
             constraint_record.confdeltype as "deleteAction"
      from pg_constraint constraint_record
      join pg_class relation
        on relation.oid = constraint_record.conrelid
      where constraint_record.connamespace = 'public'::regnamespace
        and relation.relname like 'account_deletion%'
        and constraint_record.contype = 'f'
      order by relation.relname, constraint_record.conname
    `);
    assert.deepEqual(foreignKeys.rows, [
      {
        tableName: "account_deletion_idempotency",
        name: "account_deletion_idempotency_request_id_fkey",
        definition:
          "FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
      {
        tableName: "account_deletion_jobs",
        name: "account_deletion_jobs_active_provider_action_id_fkey",
        definition:
          "FOREIGN KEY (active_provider_action_id) REFERENCES account_deletion_provider_actions(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
      {
        tableName: "account_deletion_provider_actions",
        name: "account_deletion_provider_actions_request_id_fkey",
        definition:
          "FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
      {
        tableName: "account_deletion_provider_effects",
        name: "account_deletion_provider_effects_request_id_fkey",
        definition:
          "FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
      {
        tableName: "account_deletion_reauth_proof_claims",
        name: "account_deletion_reauth_proof_claims_request_id_fkey",
        definition:
          "FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
      {
        tableName: "account_deletion_reauth_proof_claims_legacy",
        name: "account_deletion_reauth_proof_claims_legacy_request_id_fkey",
        definition:
          "FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
      {
        tableName: "account_deletion_receipts",
        name: "account_deletion_receipts_request_id_fkey",
        definition:
          "FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
      {
        tableName: "account_deletion_recovery_token_digests",
        name: "account_deletion_recovery_token_digests_request_id_fkey",
        definition:
          "FOREIGN KEY (request_id) REFERENCES account_deletion_jobs(id) ON DELETE RESTRICT",
        deleteAction: "r",
      },
    ]);
  } finally {
    await db.close();
  }
});

test("0009/0010 enforce server-only RLS, no client privileges, restrictive identity retention, and no raw recovery bearer", async () => {
  const db = await createDatabase();
  try {
    await seedValidLegacy(db);
    await db.exec(migration0010);
    const tables = [
      "account_deletion_jobs",
      "account_deletion_provider_actions",
      "account_deletion_provider_effects",
      "account_deletion_challenges",
      "account_deletion_reauth_proof_claims_legacy",
      "account_deletion_reauth_proof_claims",
      "account_deletion_idempotency",
      "account_deletion_recovery_token_digests",
      "account_deletion_receipts",
    ];
    const rls = await db.query<{ tableName: string; enabled: boolean }>(
      `
        select relname as "tableName", relrowsecurity as enabled
        from pg_class
        where relnamespace = 'public'::regnamespace
          and relname = any($1)
        order by relname
      `,
      [tables],
    );
    assert.equal(rls.rows.length, tables.length);
    assert.equal(
      rls.rows.every((row) => row.enabled),
      true,
    );
    const policies = await db.query<{ count: number }>(
      `
        select count(*)::int as count
        from pg_policy
        where polrelid in (
          select oid from pg_class
          where relnamespace = 'public'::regnamespace
            and relname = any($1)
        )
      `,
      [tables],
    );
    assert.equal(policies.rows[0]?.count, 0);
    const privileges = await db.query<{ count: number }>(
      `
        select count(*)::int as count
        from information_schema.table_privileges
        where table_schema = 'public'
          and table_name = any($1)
          and grantee in ('anon', 'authenticated')
      `,
      [tables],
    );
    assert.equal(privileges.rows[0]?.count, 0);

    const rawBearer = await db.query<{ count: number }>(
      `
        select count(*)::int as count
        from information_schema.columns
        where table_schema = 'public'
          and table_name like 'account_deletion%'
          and (
            column_name in (
              'raw_proof_binding', 'recovery_token', 'recovery_bearer'
            )
            or column_name like '%bearer%'
          )
      `,
    );
    assert.equal(rawBearer.rows[0]?.count, 0);
    const userForeignKeys = await db.query<{ count: number }>(`
      select count(*)::int as count
      from pg_constraint
      where contype = 'f'
        and confrelid = 'public.users'::regclass
        and conrelid in (
          select oid from pg_class
          where relnamespace = 'public'::regnamespace
            and relname like 'account_deletion%'
        )
    `);
    assert.equal(userForeignKeys.rows[0]?.count, 0);
  } finally {
    await db.close();
  }
});

test("0009 catalog preserves replay/idempotency uniqueness, retry correlation, immutable timestamps, and restrictive delete actions", async () => {
  const db = await createDatabase();
  try {
    const columns = await db.query<{
      tableName: string;
      columnName: string;
      nullable: string;
    }>(`
      select table_name as "tableName", column_name as "columnName",
             is_nullable as nullable
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'account_deletion_jobs'
            and column_name in (
              'deletion_starts_at', 'retry_resume_state',
              'lease_worker_id', 'lease_token', 'lease_until'
            ))
          or
          (table_name = 'account_deletion_provider_effects'
            and column_name in (
              'replay_key', 'replay_material_ciphertext',
              'checkpoint_ciphertext', 'provider_receipt_ciphertext'
            ))
        )
      order by table_name, column_name
    `);
    assert.equal(columns.rows.length, 9);
    const constraints = await db.query<{
      definition: string;
      deleteAction: string;
    }>(`
      select pg_get_constraintdef(oid) as definition,
             confdeltype as "deleteAction"
      from pg_constraint
      where connamespace = 'public'::regnamespace
        and conrelid in (
          'public.account_deletion_provider_actions'::regclass,
          'public.account_deletion_provider_effects'::regclass,
          'public.account_deletion_reauth_proof_claims_legacy'::regclass,
          'public.account_deletion_idempotency'::regclass,
          'public.account_deletion_recovery_token_digests'::regclass,
          'public.account_deletion_receipts'::regclass
        )
        and contype in ('f', 'u')
    `);
    assert.equal(
      constraints.rows
        .filter((row) =>
          row.definition.includes("REFERENCES account_deletion_jobs"),
        )
        .every((row) => row.deleteAction === "r"),
      true,
    );
    assert.ok(
      constraints.rows.some((row) =>
        row.definition.includes(
          "UNIQUE (user_id, operation_id, idempotency_key_hash)",
        ),
      ),
    );
    const indexes = await db.query<{ definition: string }>(`
      select indexdef as definition
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'account_deletion_provider_effects'
    `);
    assert.ok(
      indexes.rows.some((row) => row.definition.includes("(replay_key)")),
    );

    await seedJob(db, REQUEST_A, "user-a");
    await assert.rejects(
      db.query(
        `
          update public.account_deletion_jobs
          set deletion_starts_at = deletion_starts_at + interval '1 second'
          where id = $1
        `,
        [REQUEST_A],
      ),
    );
  } finally {
    await db.close();
  }
});

test("Drizzle metadata exactly matches the migrated protocol catalog", async () => {
  const { getTableConfig, PgDialect } = await import("drizzle-orm/pg-core");
  const schema = await import("../../../lib/db/src/schema/accountDeletions.ts");
  const tables = [
    schema.accountDeletionJobsTable,
    schema.accountDeletionProviderActionsTable,
    schema.accountDeletionProviderEffectsTable,
    schema.accountDeletionChallengesTable,
    schema.accountDeletionReauthProofClaimsLegacyTable,
    schema.accountDeletionReauthProofClaimsTable,
    schema.accountDeletionIdempotencyTable,
    schema.accountDeletionRecoveryTokenDigestsTable,
    schema.accountDeletionReceiptsTable,
  ];
  const expectedColumns = [
    "account_deletion_challenges|id|text|NO|-",
    "account_deletion_challenges|user_id|text|NO|-",
    "account_deletion_challenges|purpose|text|NO|-",
    "account_deletion_challenges|raw_proof_binding_sha256|text|NO|-",
    "account_deletion_challenges|client_hint_envelope_ciphertext|text|NO|-",
    "account_deletion_challenges|expires_at|timestamp with time zone|NO|-",
    "account_deletion_challenges|consumed_at|timestamp with time zone|YES|-",
    "account_deletion_challenges|created_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_idempotency|id|uuid|NO|gen_random_uuid()",
    "account_deletion_idempotency|user_id|text|NO|-",
    "account_deletion_idempotency|operation_id|text|NO|-",
    "account_deletion_idempotency|idempotency_key_hash|text|NO|-",
    "account_deletion_idempotency|request_fingerprint_sha256|text|NO|-",
    "account_deletion_idempotency|request_id|uuid|YES|-",
    "account_deletion_idempotency|encrypted_response_body|text|NO|-",
    "account_deletion_idempotency|response_status|integer|NO|-",
    "account_deletion_idempotency|created_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_jobs|id|uuid|NO|-",
    "account_deletion_jobs|user_id|text|NO|-",
    "account_deletion_jobs|state|text|NO|-",
    "account_deletion_jobs|state_generation|integer|NO|0",
    "account_deletion_jobs|deletion_starts_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_jobs|apple_applicable|boolean|NO|-",
    "account_deletion_jobs|active_provider_action_id|uuid|YES|-",
    "account_deletion_jobs|active_recovery_generation|integer|YES|-",
    "account_deletion_jobs|recovery_expires_at|timestamp with time zone|YES|-",
    "account_deletion_jobs|recovery_handoff_generation|integer|YES|-",
    "account_deletion_jobs|blocked_code|text|YES|-",
    "account_deletion_jobs|retry_code|text|YES|-",
    "account_deletion_jobs|retry_resume_state|text|YES|-",
    "account_deletion_jobs|lease_worker_id|text|YES|-",
    "account_deletion_jobs|lease_token|text|YES|-",
    "account_deletion_jobs|lease_until|timestamp with time zone|YES|-",
    "account_deletion_jobs|created_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_jobs|updated_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_provider_actions|id|uuid|NO|-",
    "account_deletion_provider_actions|request_id|uuid|NO|-",
    "account_deletion_provider_actions|kind|text|NO|-",
    "account_deletion_provider_actions|generation|integer|NO|-",
    "account_deletion_provider_actions|client_payload_ciphertext|text|NO|-",
    "account_deletion_provider_actions|expires_at|timestamp with time zone|NO|-",
    "account_deletion_provider_actions|consumed_at|timestamp with time zone|YES|-",
    "account_deletion_provider_actions|created_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_provider_effects|id|uuid|NO|-",
    "account_deletion_provider_effects|request_id|uuid|NO|-",
    "account_deletion_provider_effects|kind|text|NO|-",
    "account_deletion_provider_effects|object_inventory_id|uuid|YES|-",
    "account_deletion_provider_effects|replay_key|text|NO|-",
    "account_deletion_provider_effects|state|text|NO|'intent'::text",
    "account_deletion_provider_effects|attempt|integer|NO|0",
    "account_deletion_provider_effects|claimed_job_generation|integer|YES|-",
    "account_deletion_provider_effects|replay_material_ciphertext|text|YES|-",
    "account_deletion_provider_effects|checkpoint_ciphertext|text|YES|-",
    "account_deletion_provider_effects|provider_receipt_ciphertext|text|YES|-",
    "account_deletion_provider_effects|last_reason_code|text|YES|-",
    "account_deletion_provider_effects|committed_at|timestamp with time zone|YES|-",
    "account_deletion_provider_effects|created_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_provider_effects|updated_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_reauth_proof_claims|proof_id|text|NO|-",
    "account_deletion_reauth_proof_claims|request_id|uuid|NO|-",
    "account_deletion_reauth_proof_claims|user_id|text|NO|-",
    "account_deletion_reauth_proof_claims|envelope_sha256|text|NO|-",
    "account_deletion_reauth_proof_claims|consumed_at|timestamp with time zone|NO|-",
    "account_deletion_reauth_proof_claims_legacy|request_id|uuid|NO|-",
    "account_deletion_reauth_proof_claims_legacy|proof_id|text|NO|-",
    "account_deletion_reauth_proof_claims_legacy|user_id|text|NO|-",
    "account_deletion_reauth_proof_claims_legacy|envelope_sha256|text|NO|-",
    "account_deletion_reauth_proof_claims_legacy|consumed_at|timestamp with time zone|NO|now()",
    "account_deletion_receipts|receipt_id|uuid|NO|-",
    "account_deletion_receipts|request_id|uuid|NO|-",
    "account_deletion_receipts|terminal_state|text|NO|-",
    "account_deletion_receipts|data_cleanup_state|text|NO|-",
    "account_deletion_receipts|apple_state|text|NO|-",
    "account_deletion_receipts|clerk_state|text|NO|-",
    "account_deletion_receipts|object_state|text|NO|-",
    "account_deletion_receipts|terminal_code|text|YES|-",
    "account_deletion_receipts|finalized_at|timestamp with time zone|NO|transaction_timestamp()",
    "account_deletion_recovery_token_digests|request_id|uuid|NO|-",
    "account_deletion_recovery_token_digests|generation|integer|NO|-",
    "account_deletion_recovery_token_digests|token_digest_sha256|text|NO|-",
    "account_deletion_recovery_token_digests|expires_at|timestamp with time zone|NO|-",
    "account_deletion_recovery_token_digests|consumed_at|timestamp with time zone|YES|-",
    "account_deletion_recovery_token_digests|created_at|timestamp with time zone|NO|transaction_timestamp()",
  ].sort();
  const dialect = new PgDialect();
  const drizzleColumns = tables
    .flatMap((table) => {
      const config = getTableConfig(table);
      return config.columns.map((column) => {
        let defaultValue = "-";
        if (column.default !== undefined) {
          if (typeof column.default === "number") {
            defaultValue = String(column.default);
          } else if (typeof column.default === "string") {
            defaultValue = `'${column.default}'::text`;
          } else {
            assert.notEqual(column.default, null);
            defaultValue = dialect.sqlToQuery(
              column.default as Parameters<typeof dialect.sqlToQuery>[0],
            ).sql;
          }
        }
        return [
          config.name,
          column.name,
          column.getSQLType(),
          column.notNull ? "NO" : "YES",
          defaultValue,
        ].join("|");
      });
    })
    .sort();
  assert.deepEqual(drizzleColumns, expectedColumns);

  const db = await createDatabase();
  try {
    await seedValidLegacy(db);
    await db.exec(migration0010);
    const catalogColumns = await db.query<{
      tableName: string;
      columnName: string;
      sqlType: string;
      nullable: string;
      defaultValue: string | null;
    }>(`
      select relation.relname as "tableName",
             attribute.attname as "columnName",
             format_type(attribute.atttypid, attribute.atttypmod) as "sqlType",
             case when attribute.attnotnull then 'NO' else 'YES' end
               as nullable,
             pg_get_expr(default_record.adbin, default_record.adrelid)
               as "defaultValue"
      from pg_class relation
      join pg_attribute attribute
        on attribute.attrelid = relation.oid
       and attribute.attnum > 0
       and not attribute.attisdropped
      left join pg_attrdef default_record
        on default_record.adrelid = relation.oid
       and default_record.adnum = attribute.attnum
      where relation.relnamespace = 'public'::regnamespace
        and relation.relkind in ('r', 'p')
        and relation.relname like 'account_deletion%'
      order by relation.relname, attribute.attnum
    `);
    assert.deepEqual(
      catalogColumns.rows
        .map((row) =>
          [
            row.tableName,
            row.columnName,
            row.sqlType,
            row.nullable,
            row.defaultValue ?? "-",
          ].join("|"),
        )
        .sort(),
      expectedColumns,
    );

    const drizzlePrimaryUnique = tables
      .flatMap((table) => {
        const config = getTableConfig(table);
        return [
          ...config.columns
            .filter((column) => column.primary)
            .map((column) => ({
              tableName: config.name,
              name: `${config.name}_pkey`,
              kind: "p",
              columns: [column.name],
            })),
          ...config.primaryKeys.map((key) => ({
            tableName: config.name,
            name: key.getName(),
            kind: "p",
            columns: key.columns.map((column) => column.name),
          })),
          ...config.columns
            .filter((column) => column.isUnique)
            .map((column) => ({
              tableName: config.name,
              name: column.uniqueName!,
              kind: "u",
              columns: [column.name],
            })),
          ...config.uniqueConstraints.map((key) => ({
            tableName: config.name,
            name: key.getName()!,
            kind: "u",
            columns: key.columns.map((column) => column.name),
          })),
        ];
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    const catalogPrimaryUnique = await db.query<{
      tableName: string;
      name: string;
      kind: string;
      columns: string[];
    }>(`
      select relation.relname as "tableName",
             constraint_record.conname as name,
             constraint_record.contype::text as kind,
             array_agg(attribute.attname order by key_column.ordinality)
               as columns
      from pg_constraint constraint_record
      join pg_class relation on relation.oid = constraint_record.conrelid
      join unnest(constraint_record.conkey) with ordinality
        key_column(attnum, ordinality) on true
      join pg_attribute attribute
        on attribute.attrelid = relation.oid
       and attribute.attnum = key_column.attnum
      where relation.relnamespace = 'public'::regnamespace
        and relation.relname like 'account_deletion%'
        and constraint_record.contype in ('p', 'u')
      group by relation.relname, constraint_record.conname,
               constraint_record.contype
      order by constraint_record.conname
    `);
    assert.deepEqual(catalogPrimaryUnique.rows, drizzlePrimaryUnique);

    const drizzleForeignKeys = tables
      .flatMap((table) => {
        const config = getTableConfig(table);
        return config.foreignKeys.map((key) => {
          const reference = key.reference();
          return {
            tableName: config.name,
            name: key.getName(),
            columns: reference.columns.map((column) => column.name),
            foreignTable: getTableConfig(reference.foreignTable).name,
            foreignColumns: reference.foreignColumns.map(
              (column) => column.name,
            ),
            deleteAction: key.onDelete ?? "no action",
          };
        });
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    const catalogForeignKeys = await db.query<{
      tableName: string;
      name: string;
      columns: string[];
      foreignTable: string;
      foreignColumns: string[];
      deleteAction: string;
    }>(`
      select relation.relname as "tableName",
             constraint_record.conname as name,
             array_agg(local_attribute.attname order by local_key.ordinality)
               as columns,
             foreign_relation.relname as "foreignTable",
             array_agg(foreign_attribute.attname order by local_key.ordinality)
               as "foreignColumns",
             case constraint_record.confdeltype
               when 'r' then 'restrict'
               when 'c' then 'cascade'
               when 'n' then 'set null'
               when 'd' then 'set default'
               else 'no action'
             end as "deleteAction"
      from pg_constraint constraint_record
      join pg_class relation on relation.oid = constraint_record.conrelid
      join pg_class foreign_relation
        on foreign_relation.oid = constraint_record.confrelid
      join unnest(constraint_record.conkey) with ordinality
        local_key(attnum, ordinality) on true
      join unnest(constraint_record.confkey) with ordinality
        foreign_key(attnum, ordinality)
        on foreign_key.ordinality = local_key.ordinality
      join pg_attribute local_attribute
        on local_attribute.attrelid = relation.oid
       and local_attribute.attnum = local_key.attnum
      join pg_attribute foreign_attribute
        on foreign_attribute.attrelid = foreign_relation.oid
       and foreign_attribute.attnum = foreign_key.attnum
      where relation.relnamespace = 'public'::regnamespace
        and relation.relname like 'account_deletion%'
        and constraint_record.contype = 'f'
      group by relation.relname, constraint_record.conname,
               foreign_relation.relname, constraint_record.confdeltype
      order by constraint_record.conname
    `);
    assert.deepEqual(catalogForeignKeys.rows, drizzleForeignKeys);

    for (const table of tables) {
      const config = getTableConfig(table);
      const quotedTableName = `"${config.name.replaceAll('"', '""')}"`;
      await db.exec(
        `create temporary table ${quotedTableName}
         (like public.${quotedTableName})`,
      );
      for (const checkRecord of config.checks) {
        const compiled = dialect.sqlToQuery(checkRecord.value);
        assert.deepEqual(
          compiled.params,
          [],
          `parameterized Drizzle check: ${checkRecord.name}`,
        );
        const quotedCheckName = `"${checkRecord.name.replaceAll('"', '""')}"`;
        await db.exec(
          `alter table pg_temp.${quotedTableName}
           add constraint ${quotedCheckName}
           check (${compiled.sql})`,
        );
      }
    }
    const drizzleChecks = await db.query<{
      tableName: string;
      name: string;
      definition: string;
    }>(`
      select relation.relname as "tableName",
             constraint_record.conname as name,
             pg_get_constraintdef(constraint_record.oid, false)
               as definition
      from pg_constraint constraint_record
      join pg_class relation on relation.oid = constraint_record.conrelid
      where relation.relnamespace = pg_my_temp_schema()
        and relation.relname like 'account_deletion%'
        and constraint_record.contype = 'c'
      order by relation.relname, constraint_record.conname
    `);
    const catalogChecks = await db.query<{
      tableName: string;
      name: string;
      definition: string;
      validated: boolean;
    }>(`
      select relation.relname as "tableName",
             constraint_record.conname as name,
             pg_get_constraintdef(constraint_record.oid, false)
               as definition,
             constraint_record.convalidated as validated
      from pg_constraint constraint_record
      join pg_class relation on relation.oid = constraint_record.conrelid
      where relation.relnamespace = 'public'::regnamespace
        and relation.relname like 'account_deletion%'
        and constraint_record.contype = 'c'
      order by relation.relname, constraint_record.conname
    `);
    assert.equal(
      catalogChecks.rows.every((checkRecord) => checkRecord.validated),
      true,
    );
    assert.deepEqual(
      catalogChecks.rows.map(({ validated: _validated, ...checkRecord }) => ({
        ...checkRecord,
        definition: checkRecord.definition.trim(),
      })),
      drizzleChecks.rows.map((checkRecord) => ({
        ...checkRecord,
        definition: checkRecord.definition.trim(),
      })),
    );

    const drizzleIndexes = tables
      .flatMap((table) => {
        const config = getTableConfig(table);
        return config.indexes.map((indexRecord) => ({
          tableName: config.name,
          name: indexRecord.config.name!,
          unique: indexRecord.config.unique,
          method: indexRecord.config.method ?? "btree",
          columns: indexRecord.config.columns.map((column) => {
            if (!("name" in column) || typeof column.name !== "string") {
              throw new TypeError("expression indexes are not in Task 1");
            }
            return column.name;
          }),
        }));
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    const catalogIndexes = await db.query<{
      tableName: string;
      name: string;
      unique: boolean;
      method: string;
      columns: string[];
    }>(`
      select relation.relname as "tableName",
             index_relation.relname as name,
             index_record.indisunique as unique,
             access_method.amname as method,
             array_agg(attribute.attname order by key_column.ordinality)
               as columns
      from pg_index index_record
      join pg_class relation on relation.oid = index_record.indrelid
      join pg_class index_relation
        on index_relation.oid = index_record.indexrelid
      join pg_am access_method on access_method.oid = index_relation.relam
      join unnest(index_record.indkey) with ordinality
        key_column(attnum, ordinality) on key_column.attnum > 0
      join pg_attribute attribute
        on attribute.attrelid = relation.oid
       and attribute.attnum = key_column.attnum
      where relation.relnamespace = 'public'::regnamespace
        and relation.relname like 'account_deletion%'
        and not exists (
          select 1 from pg_constraint constraint_record
          where constraint_record.conindid = index_record.indexrelid
        )
      group by relation.relname, index_relation.relname,
               index_record.indisunique, access_method.amname
      order by index_relation.relname
    `);
    assert.deepEqual(catalogIndexes.rows, drizzleIndexes);
  } finally {
    await db.close();
  }
});
