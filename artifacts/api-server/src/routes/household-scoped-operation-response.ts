import type { Response } from "express";

import { HouseholdAuthoritySnapshotError } from "../lib/household-me-snapshot.ts";
import {
  HouseholdScopedOperationError,
  type HouseholdScopedOperationScope,
  type RunHouseholdScopedOperation,
} from "../lib/household-scoped-operation.ts";

export interface HouseholdScopedOperationReply {
  status(status: number): HouseholdScopedOperationReply;
  json(body: unknown): void;
  sendStatus(status: number): void;
}

class DeferredHouseholdScopedOperationReply
  implements HouseholdScopedOperationReply
{
  private statusCode = 200;
  private terminal: { kind: "json"; body: unknown } | { kind: "empty" } | null =
    null;

  status(status: number): HouseholdScopedOperationReply {
    if (this.terminal) {
      throw new Error("Household operation response is already complete.");
    }
    this.statusCode = status;
    return this;
  }

  json(body: unknown): void {
    if (this.terminal) {
      throw new Error("Household operation response is already complete.");
    }
    this.terminal = { kind: "json", body };
  }

  sendStatus(status: number): void {
    if (this.terminal) {
      throw new Error("Household operation response is already complete.");
    }
    this.statusCode = status;
    this.terminal = { kind: "empty" };
  }

  flush(res: Response): void {
    if (!this.terminal) {
      throw new Error("Household operation completed without a response.");
    }
    if (this.terminal.kind === "empty") {
      res.sendStatus(this.statusCode);
      return;
    }
    res.status(this.statusCode).json(this.terminal.body);
  }
}

function isHouseholdAuthorityError(
  error: unknown,
): error is HouseholdScopedOperationError | HouseholdAuthoritySnapshotError {
  if (
    error instanceof HouseholdScopedOperationError ||
    error instanceof HouseholdAuthoritySnapshotError
  ) {
    return true;
  }
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { status?: unknown };
  return (
    (candidate.name === "HouseholdScopedOperationError" ||
      candidate.name === "HouseholdAuthoritySnapshotError") &&
    (candidate.status === 403 ||
      candidate.status === 409 ||
      candidate.status === 412)
  );
}

/**
 * Defers the HTTP response until the scoped runner has committed. This keeps
 * mutation, audit, and Exact Me snapshot failures from leaking a false 2xx.
 */
export async function runHouseholdScopedRouteOperation(input: {
  res: Response;
  userId: string;
  expectedHouseholdId: string;
  runHouseholdScopedOperation: RunHouseholdScopedOperation;
  operation: (
    scope: HouseholdScopedOperationScope,
    reply: HouseholdScopedOperationReply,
  ) => Promise<void>;
}): Promise<void> {
  const reply = new DeferredHouseholdScopedOperationReply();
  try {
    await input.runHouseholdScopedOperation({
      userId: input.userId,
      expectedHouseholdId: input.expectedHouseholdId,
      operation: (scope) => input.operation(scope, reply),
    });
  } catch (error) {
    if (!isHouseholdAuthorityError(error)) throw error;
    input.res.status(error.status).json({ error: error.message });
    return;
  }
  reply.flush(input.res);
}
