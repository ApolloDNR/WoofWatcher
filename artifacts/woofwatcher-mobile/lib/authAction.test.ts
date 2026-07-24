import assert from "node:assert/strict";
import test from "node:test";

type AuthActionModule = typeof import("./authAction.ts");

async function loadAuthAction(): Promise<AuthActionModule> {
  try {
    return await import("./authAction.ts");
  } catch {
    assert.fail("authAction.ts must provide the staged-auth failure boundary");
  }
}

test("rejected staged auth actions show bounded owner copy and always release loading", async () => {
  const { executeAuthAction } = await loadAuthAction();
  const loading: boolean[] = [];
  const errors: Array<string | undefined> = [];
  let finalized = false;

  const succeeded = await executeAuthAction({
    setLoading: (value) => loading.push(value),
    setError: (message) => errors.push(message),
    thrownMessage: "Verification could not finish.",
    action: async () => {
      throw new Error("private provider trace");
    },
    onFinally: () => {
      finalized = true;
    },
  });

  assert.equal(succeeded, false);
  assert.deepEqual(loading, [true, false]);
  assert.deepEqual(errors, [undefined, "Verification could not finish."]);
  assert.equal(finalized, true);
});

test("returned provider errors stay owner-safe and always release loading", async () => {
  const { executeAuthAction, ownerSafeProviderError } = await loadAuthAction();
  const loading: boolean[] = [];
  const errors: Array<string | undefined> = [];

  const succeeded = await executeAuthAction({
    setLoading: (value) => loading.push(value),
    setError: (message) => errors.push(message),
    thrownMessage: "Could not resend the verification code.",
    action: async () =>
      ownerSafeProviderError(
        {
          message: "developer-only request identifier",
          longMessage: "  Please wait before requesting another code.  ",
        },
        "Could not resend the verification code.",
      ),
  });

  assert.equal(succeeded, false);
  assert.deepEqual(loading, [true, false]);
  assert.deepEqual(errors, [
    undefined,
    "Please wait before requesting another code.",
  ]);
});

test("provider developer messages are never exposed and long owner copy is bounded", async () => {
  const { ownerSafeProviderError } = await loadAuthAction();

  assert.equal(
    ownerSafeProviderError(
      { message: "internal request failed at provider" },
      "Could not sign in.",
    ),
    "Could not sign in.",
  );
  assert.equal(
    ownerSafeProviderError(
      { longMessage: "x".repeat(400) },
      "Could not create your account.",
    ).length,
    240,
  );
});

test("sign-in credential failures never reveal whether an account exists", async () => {
  const { signInCredentialError } = await loadAuthAction();

  const unknownAccount = signInCredentialError({
    longMessage: "Couldn't find your account.",
  });
  const wrongPassword = signInCredentialError({
    longMessage: "Password is incorrect.",
  });

  assert.equal(unknownAccount, wrongPassword);
  assert.equal(
    unknownAccount,
    "Could not sign in. Check your details and try again.",
  );
});

test("sign-up initiation failures never reveal whether an account exists", async () => {
  const { signUpCredentialError } = await loadAuthAction();

  const existingAccount = signUpCredentialError({
    longMessage: "That email address is already registered.",
  });
  const invalidAddress = signUpCredentialError({
    longMessage: "That email address is not valid.",
  });
  const rejectedPassword = signUpCredentialError({
    longMessage: "This password was found in a data breach.",
  });

  assert.equal(existingAccount, invalidAddress);
  assert.equal(existingAccount, rejectedPassword);
  assert.equal(
    existingAccount,
    "Could not start account setup. Check your details and try again.",
  );
});
