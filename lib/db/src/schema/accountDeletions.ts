import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { PgTableExtraConfigValue } from "drizzle-orm/pg-core";

const transactionTimestamp = sql`transaction_timestamp()`;

export const accountDeletionJobsTable = pgTable(
  "account_deletion_jobs",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    state: text("state").notNull(),
    stateGeneration: integer("state_generation").notNull().default(0),
    deletionStartsAt: timestamp("deletion_starts_at", {
      withTimezone: true,
    })
      .notNull()
      .default(transactionTimestamp),
    appleApplicable: boolean("apple_applicable").notNull(),
    activeProviderActionId: uuid("active_provider_action_id"),
    activeRecoveryGeneration: integer("active_recovery_generation"),
    recoveryExpiresAt: timestamp("recovery_expires_at", {
      withTimezone: true,
    }),
    recoveryHandoffGeneration: integer("recovery_handoff_generation"),
    blockedCode: text("blocked_code"),
    retryCode: text("retry_code"),
    retryResumeState: text("retry_resume_state"),
    leaseWorkerId: text("lease_worker_id"),
    leaseToken: text("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      name: "account_deletion_jobs_active_provider_action_id_fkey",
      columns: [table.activeProviderActionId],
      foreignColumns: [accountDeletionProviderActionsTable.id],
    }).onDelete("restrict"),
    check(
      "account_deletion_jobs_user_nonblank",
      sql`btrim(${table.userId}) <> ''`,
    ),
    check(
      "account_deletion_jobs_state",
      sql`${table.state} in (
        'challenge_required', 'reauth_verified', 'provider_action_required',
        'accepted', 'apple_revoking', 'apple_revoked', 'preflight',
        'cleanup_pending', 'cleanup_running', 'object_inventory',
        'object_cleanup_pending', 'object_cleanup_running',
        'object_cleanup_complete', 'clerk_deleting', 'receipt_finalizing',
        'retry_required', 'blocked', 'failed', 'succeeded'
      )`,
    ),
    check(
      "account_deletion_jobs_state_generation",
      sql`${table.stateGeneration} >= 0`,
    ),
    check(
      "account_deletion_jobs_blocked_code",
      sql`${table.blockedCode} is null or ${table.blockedCode} in (
        'last_owner', 'missing_user', 'provider_unavailable'
      )`,
    ),
    check(
      "account_deletion_jobs_retry_resume_state",
      sql`${table.retryResumeState} is null or ${table.retryResumeState} in (
        'apple_revoking', 'cleanup_pending', 'object_inventory',
        'object_cleanup_running', 'clerk_deleting', 'receipt_finalizing'
      )`,
    ),
    check(
      "account_deletion_jobs_retry_correlation",
      sql`(${table.state} = 'retry_required') =
        (${table.retryResumeState} is not null and ${table.retryCode} is not null)`,
    ),
    check(
      "account_deletion_jobs_lease_correlation",
      sql`(
        ${table.leaseWorkerId} is null and ${table.leaseToken} is null
        and ${table.leaseUntil} is null
      ) or (
        ${table.leaseWorkerId} is not null and ${table.leaseToken} is not null
        and ${table.leaseUntil} is not null
      )`,
    ),
    check(
      "account_deletion_jobs_recovery_correlation",
      sql`(
        ${table.activeRecoveryGeneration} is null
        and ${table.recoveryExpiresAt} is null
      ) or (
        ${table.activeRecoveryGeneration} is not null
        and ${table.recoveryExpiresAt} is not null
      )`,
    ),
  ],
).enableRLS();

export const accountDeletionProviderActionsTable = pgTable(
  "account_deletion_provider_actions",
  {
    id: uuid("id").primaryKey(),
    requestId: uuid("request_id").notNull(),
    kind: text("kind").notNull(),
    generation: integer("generation").notNull(),
    clientPayloadCiphertext: text("client_payload_ciphertext").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
  },
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      name: "account_deletion_provider_actions_request_id_fkey",
      columns: [table.requestId],
      foreignColumns: [accountDeletionJobsTable.id],
    }).onDelete("restrict"),
    check(
      "account_deletion_provider_actions_kind",
      sql`${table.kind} in (
        'clerk_reauthentication', 'apple_reauthorization'
      )`,
    ),
    check(
      "account_deletion_provider_actions_generation",
      sql`${table.generation} >= 0`,
    ),
    unique("account_deletion_provider_actions_request_id_generation_key").on(
      table.requestId,
      table.generation,
    ),
    index("account_deletion_provider_actions_request_id_idx").on(
      table.requestId,
    ),
  ],
).enableRLS();

export const accountDeletionProviderEffectsTable = pgTable(
  "account_deletion_provider_effects",
  {
    id: uuid("id").primaryKey(),
    requestId: uuid("request_id").notNull(),
    kind: text("kind").notNull(),
    objectInventoryId: uuid("object_inventory_id"),
    replayKey: text("replay_key").notNull(),
    state: text("state").notNull().default("intent"),
    attempt: integer("attempt").notNull().default(0),
    claimedJobGeneration: integer("claimed_job_generation"),
    replayMaterialCiphertext: text("replay_material_ciphertext"),
    checkpointCiphertext: text("checkpoint_ciphertext"),
    providerReceiptCiphertext: text("provider_receipt_ciphertext"),
    lastReasonCode: text("last_reason_code"),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
  },
  (table) => [
    foreignKey({
      name: "account_deletion_provider_effects_request_id_fkey",
      columns: [table.requestId],
      foreignColumns: [accountDeletionJobsTable.id],
    }).onDelete("restrict"),
    check(
      "account_deletion_provider_effects_kind",
      sql`${table.kind} in ('apple_revoke', 'object_delete', 'clerk_delete')`,
    ),
    check(
      "account_deletion_provider_effects_replay_key",
      sql`btrim(${table.replayKey}) <> ''`,
    ),
    check(
      "account_deletion_provider_effects_state",
      sql`${table.state} in (
        'intent', 'claimed', 'checkpointed', 'committed',
        'retry_required', 'indeterminate'
      )`,
    ),
    check(
      "account_deletion_provider_effects_attempt",
      sql`${table.attempt} >= 0`,
    ),
    unique("account_deletion_provider_effects_replay_key_key").on(
      table.replayKey,
    ),
    check(
      "account_deletion_effect_object_kind",
      sql`(
        ${table.kind} = 'object_delete' and ${table.objectInventoryId} is not null
      ) or (
        ${table.kind} <> 'object_delete' and ${table.objectInventoryId} is null
      )`,
    ),
    index("account_deletion_provider_effects_request_kind_idx").on(
      table.requestId,
      table.kind,
    ),
  ],
).enableRLS();

export const accountDeletionChallengesTable = pgTable(
  "account_deletion_challenges",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    purpose: text("purpose").notNull(),
    rawProofBindingSha256: text("raw_proof_binding_sha256").notNull(),
    clientHintEnvelopeCiphertext: text(
      "client_hint_envelope_ciphertext",
    ).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
  },
  (table) => [
    check(
      "account_deletion_challenges_id_nonblank",
      sql`btrim(${table.id}) <> ''`,
    ),
    check(
      "account_deletion_challenges_user_nonblank",
      sql`btrim(${table.userId}) <> ''`,
    ),
    check(
      "account_deletion_challenges_purpose",
      sql`${table.purpose} = 'account_deletion'`,
    ),
    check(
      "account_deletion_challenges_binding_digest",
      sql`${table.rawProofBindingSha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
).enableRLS();

export const accountDeletionReauthProofClaimsLegacyTable = pgTable(
  "account_deletion_reauth_proof_claims_legacy",
  {
    requestId: uuid("request_id").notNull(),
    proofId: text("proof_id").notNull(),
    userId: text("user_id").notNull(),
    envelopeSha256: text("envelope_sha256").notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "account_deletion_reauth_proof_claims_legacy_request_id_fkey",
      columns: [table.requestId],
      foreignColumns: [accountDeletionJobsTable.id],
    }).onDelete("restrict"),
    primaryKey({
      name: "account_deletion_reauth_proof_claims_legacy_pkey",
      columns: [table.requestId, table.proofId],
    }),
  ],
).enableRLS();

export const accountDeletionReauthProofClaimsTable = pgTable(
  "account_deletion_reauth_proof_claims",
  {
    proofId: text("proof_id").primaryKey(),
    requestId: uuid("request_id").notNull(),
    userId: text("user_id").notNull(),
    envelopeSha256: text("envelope_sha256").notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      name: "account_deletion_reauth_proof_claims_request_id_fkey",
      columns: [table.requestId],
      foreignColumns: [accountDeletionJobsTable.id],
    }).onDelete("restrict"),
    check(
      "account_deletion_reauth_proof_claims_proof_nonblank",
      sql`btrim(${table.proofId}, E' \t\n\r\f\v') <> ''`,
    ),
    check(
      "account_deletion_reauth_proof_claims_user_nonblank",
      sql`btrim(${table.userId}, E' \t\n\r\f\v') <> ''`,
    ),
    check(
      "account_deletion_reauth_proof_claims_digest",
      sql`${table.envelopeSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    unique("account_deletion_reauth_proof_claims_request_id_key").on(
      table.requestId,
    ),
  ],
).enableRLS();

export const accountDeletionIdempotencyTable = pgTable(
  "account_deletion_idempotency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    operationId: text("operation_id").notNull(),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    requestFingerprintSha256: text("request_fingerprint_sha256").notNull(),
    requestId: uuid("request_id"),
    encryptedResponseBody: text("encrypted_response_body").notNull(),
    responseStatus: integer("response_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
  },
  (table) => [
    foreignKey({
      name: "account_deletion_idempotency_request_id_fkey",
      columns: [table.requestId],
      foreignColumns: [accountDeletionJobsTable.id],
    }).onDelete("restrict"),
    check(
      "account_deletion_idempotency_user_nonblank",
      sql`btrim(${table.userId}) <> ''`,
    ),
    check(
      "account_deletion_idempotency_operation_nonblank",
      sql`btrim(${table.operationId}) <> ''`,
    ),
    check(
      "account_deletion_idempotency_key_digest",
      sql`${table.idempotencyKeyHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "account_deletion_idempotency_fingerprint_digest",
      sql`${table.requestFingerprintSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "account_deletion_idempotency_response_status",
      sql`${table.responseStatus} between 100 and 599`,
    ),
    unique("account_deletion_idempotency_user_operation_key").on(
      table.userId,
      table.operationId,
      table.idempotencyKeyHash,
    ),
  ],
).enableRLS();

export const accountDeletionRecoveryTokenDigestsTable = pgTable(
  "account_deletion_recovery_token_digests",
  {
    requestId: uuid("request_id").notNull(),
    generation: integer("generation").notNull(),
    tokenDigestSha256: text("token_digest_sha256").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
  },
  (table) => [
    foreignKey({
      name: "account_deletion_recovery_token_digests_request_id_fkey",
      columns: [table.requestId],
      foreignColumns: [accountDeletionJobsTable.id],
    }).onDelete("restrict"),
    check(
      "account_deletion_recovery_token_generation",
      sql`${table.generation} >= 0`,
    ),
    check(
      "account_deletion_recovery_token_digest",
      sql`${table.tokenDigestSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    unique("account_deletion_recovery_token_digest_sha256_key").on(
      table.tokenDigestSha256,
    ),
    primaryKey({
      name: "account_deletion_recovery_token_digests_pkey",
      columns: [table.requestId, table.generation],
    }),
  ],
).enableRLS();

export const accountDeletionReceiptsTable = pgTable(
  "account_deletion_receipts",
  {
    receiptId: uuid("receipt_id").primaryKey(),
    requestId: uuid("request_id").notNull(),
    terminalState: text("terminal_state").notNull(),
    dataCleanupState: text("data_cleanup_state").notNull(),
    appleState: text("apple_state").notNull(),
    clerkState: text("clerk_state").notNull(),
    objectState: text("object_state").notNull(),
    terminalCode: text("terminal_code"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true })
      .notNull()
      .default(transactionTimestamp),
  },
  (table) => [
    foreignKey({
      name: "account_deletion_receipts_request_id_fkey",
      columns: [table.requestId],
      foreignColumns: [accountDeletionJobsTable.id],
    }).onDelete("restrict"),
    check(
      "account_deletion_receipts_terminal_state",
      sql`${table.terminalState} in ('blocked', 'failed', 'succeeded')`,
    ),
    check(
      "account_deletion_receipts_data_cleanup_state",
      sql`${table.dataCleanupState} in ('not_started', 'partial', 'complete')`,
    ),
    check(
      "account_deletion_receipts_apple_state",
      sql`${table.appleState} in ('not_applicable', 'revoked', 'unresolved')`,
    ),
    check(
      "account_deletion_receipts_clerk_state",
      sql`${table.clerkState} in (
        'present', 'deleted', 'already_absent', 'unresolved'
      )`,
    ),
    check(
      "account_deletion_receipts_object_state",
      sql`${table.objectState} in ('not_started', 'partial', 'complete')`,
    ),
    unique("account_deletion_receipts_request_id_key").on(table.requestId),
  ],
).enableRLS();

export type AccountDeletionJob = typeof accountDeletionJobsTable.$inferSelect;
export type AccountDeletionProviderAction =
  typeof accountDeletionProviderActionsTable.$inferSelect;
export type AccountDeletionProviderEffect =
  typeof accountDeletionProviderEffectsTable.$inferSelect;
