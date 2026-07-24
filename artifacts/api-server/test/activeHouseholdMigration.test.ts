import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/0005_user_active_household.sql",
    import.meta.url,
  ),
  "utf8",
);

const households = {
  h1: "00000000-0000-0000-0000-000000000001",
  h2: "00000000-0000-0000-0000-000000000002",
  h3: "00000000-0000-0000-0000-000000000003",
  h4: "00000000-0000-0000-0000-000000000004",
} as const;

async function createMigrationDatabase(input?: { columnOnly?: boolean }) {
  const db = new PGlite();
  await db.exec(`
    create table public.households (
      id uuid primary key
    );
    create table public.users (
      id text primary key
      ${input?.columnOnly ? ", active_household_id uuid" : ""}
    );
    create table public.household_members (
      household_id uuid not null,
      user_id text not null,
      created_at timestamptz not null,
      primary key (household_id, user_id)
    );
    insert into public.households (id) values
      ('${households.h1}'),
      ('${households.h2}'),
      ('${households.h3}'),
      ('${households.h4}');
  `);
  return db;
}

async function readActiveHouseholds(db: PGlite) {
  const result = await db.query<{
    id: string;
    active_household_id: string | null;
  }>(`
    select id, active_household_id
    from public.users
    order by id
  `);
  return result.rows;
}

async function readActiveHouseholdSchema(db: PGlite) {
  const foreignKeys = await db.query<{
    name: string;
    deleteAction: string;
    definition: string;
  }>(`
    select
      constraint_record.conname as name,
      constraint_record.confdeltype as "deleteAction",
      pg_get_constraintdef(constraint_record.oid) as definition
    from pg_constraint as constraint_record
    join pg_class as relation
      on relation.oid = constraint_record.conrelid
    join pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'users'
      and constraint_record.contype = 'f'
  `);
  const indexes = await db.query<{
    name: string;
    definition: string;
  }>(`
    select indexname as name, indexdef as definition
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'users'
      and indexname = 'users_active_household_id_idx'
  `);

  return {
    foreignKeys: foreignKeys.rows,
    indexes: indexes.rows,
  };
}

function assertActiveHouseholdSchema(
  schema: Awaited<ReturnType<typeof readActiveHouseholdSchema>>,
) {
  assert.deepEqual(schema.foreignKeys, [
    {
      name: "users_active_household_id_fkey",
      deleteAction: "n",
      definition:
        "FOREIGN KEY (active_household_id) REFERENCES households(id) ON DELETE SET NULL",
    },
  ]);
  assert.equal(schema.indexes.length, 1);
  assert.equal(schema.indexes[0]?.name, "users_active_household_id_idx");
  assert.match(
    schema.indexes[0]?.definition ?? "",
    /ON public\.users USING btree \(active_household_id\)$/,
  );
}

test("migration 0005 executes twice with deterministic backfill and one FK/index", async () => {
  const db = await createMigrationDatabase();
  try {
    await db.exec(`
      insert into public.users (id) values ('user_a'), ('user_b');
      insert into public.household_members
        (household_id, user_id, created_at)
      values
        ('${households.h2}', 'user_a', '2026-07-20T10:00:00.000Z'),
        ('${households.h1}', 'user_a', '2026-07-20T10:00:00.000Z'),
        ('${households.h4}', 'user_b', '2026-07-19T10:00:00.000Z');
    `);

    await db.exec(migration);
    assert.deepEqual(await readActiveHouseholds(db), [
      { id: "user_a", active_household_id: households.h1 },
      { id: "user_b", active_household_id: households.h4 },
    ]);

    await db.exec(migration);
    assert.deepEqual(await readActiveHouseholds(db), [
      { id: "user_a", active_household_id: households.h1 },
      { id: "user_b", active_household_id: households.h4 },
    ]);
    assertActiveHouseholdSchema(await readActiveHouseholdSchema(db));

    await db.query("delete from public.households where id = $1", [
      households.h1,
    ]);
    assert.deepEqual(await readActiveHouseholds(db), [
      { id: "user_a", active_household_id: null },
      { id: "user_b", active_household_id: households.h4 },
    ]);
  } finally {
    await db.close();
  }
});

test("migration 0005 resumes a column-only state and repairs FK/index/backfill", async () => {
  const db = await createMigrationDatabase({ columnOnly: true });
  try {
    await db.exec(`
      insert into public.users (id, active_household_id) values
        ('user_a', null),
        ('user_b', '${households.h3}');
      insert into public.household_members
        (household_id, user_id, created_at)
      values
        ('${households.h2}', 'user_a', '2026-07-20T10:00:00.000Z'),
        ('${households.h4}', 'user_b', '2026-07-19T10:00:00.000Z');
    `);

    assert.deepEqual(await readActiveHouseholdSchema(db), {
      foreignKeys: [],
      indexes: [],
    });
    await db.exec(migration);

    assert.deepEqual(await readActiveHouseholds(db), [
      { id: "user_a", active_household_id: households.h2 },
      { id: "user_b", active_household_id: households.h3 },
    ]);
    assertActiveHouseholdSchema(await readActiveHouseholdSchema(db));
  } finally {
    await db.close();
  }
});
