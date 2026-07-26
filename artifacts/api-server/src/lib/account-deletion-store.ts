export type { AccountDeletionStore } from "./account-deletion.ts";

export class AccountDeletionConflictError extends Error {
  constructor(message = "account deletion compare-and-set conflict") {
    super(message);
    this.name = "AccountDeletionConflictError";
  }
}
