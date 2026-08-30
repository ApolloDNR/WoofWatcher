import type { Request, Response } from "express";

import {
  HouseholdScopedOperationError,
  type HouseholdScopedOperationScope,
  type RunHouseholdScopedOperation,
} from "../lib/household-scoped-operation.ts";
import {
  EXPECTED_HOUSEHOLD_HEADER,
  parseExpectedHouseholdCapability,
  verifyExpectedHouseholdCapability,
} from "./household-capability.ts";

export { EXPECTED_HOUSEHOLD_HEADER };

export async function requireExpectedHousehold(input: {
  req: Request;
  res: Response;
  userId: string;
  getActiveHouseholdId: (userId: string) => Promise<string>;
}): Promise<string | null> {
  const capability = parseExpectedHouseholdCapability(input.req, input.res);
  if (!capability) return null;

  const activeHouseholdId = await input.getActiveHouseholdId(input.userId);
  return verifyExpectedHouseholdCapability({
    capability,
    actualHouseholdId: activeHouseholdId,
    res: input.res,
  });
}

function isScopedOperationError(
  error: unknown,
): error is HouseholdScopedOperationError {
  if (error instanceof HouseholdScopedOperationError) return true;
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { status?: unknown };
  return (
    candidate.name === "HouseholdScopedOperationError" &&
    (candidate.status === 403 ||
      candidate.status === 409 ||
      candidate.status === 412)
  );
}

export interface CareHouseholdOperationReply {
  status(status: number): CareHouseholdOperationReply;
  json(body: unknown): void;
  sendStatus(status: number): void;
}

class DeferredCareHouseholdOperationReply implements CareHouseholdOperationReply {
  private statusCode = 200;
  private terminal: { kind: "json"; body: unknown } | { kind: "empty" } | null =
    null;

  status(status: number): CareHouseholdOperationReply {
    if (this.terminal) {
      throw new Error("Care operation response is already complete.");
    }
    this.statusCode = status;
    return this;
  }

  json(body: unknown): void {
    if (this.terminal) {
      throw new Error("Care operation response is already complete.");
    }
    this.terminal = { kind: "json", body };
  }

  sendStatus(status: number): void {
    if (this.terminal) {
      throw new Error("Care operation response is already complete.");
    }
    this.statusCode = status;
    this.terminal = { kind: "empty" };
  }

  flush(res: Response): void {
    if (!this.terminal) {
      throw new Error("Care operation completed without a response.");
    }
    if (this.terminal.kind === "empty") {
      res.sendStatus(this.statusCode);
      return;
    }
    res.status(this.statusCode).json(this.terminal.body);
  }
}

/**
 * Parses the header before opening any authority transaction, then keeps the
 * route's complete Care-table operation inside the exact identity/membership
 * transaction supplied by the scoped runner.
 */
export async function runExpectedCareHouseholdOperation(input: {
  req: Request;
  res: Response;
  userId: string;
  runHouseholdScopedOperation: RunHouseholdScopedOperation;
  /** Serialize destructive/idempotent mutations before authority row locks. */
  serializeHouseholdMutation?: boolean;
  operation: (
    scope: HouseholdScopedOperationScope,
    reply: CareHouseholdOperationReply,
  ) => Promise<void>;
}): Promise<void> {
  const capability = parseExpectedHouseholdCapability(input.req, input.res);
  if (!capability) return;

  const reply = new DeferredCareHouseholdOperationReply();
  try {
    await input.runHouseholdScopedOperation({
      userId: input.userId,
      expectedHouseholdId: capability.expectedHouseholdId,
      serializeHouseholdMutation: input.serializeHouseholdMutation,
      operation: (scope) => input.operation(scope, reply),
    });
  } catch (error) {
    if (!isScopedOperationError(error)) throw error;
    input.res.status(error.status).json({ error: error.message });
    return;
  }
  reply.flush(input.res);
}
