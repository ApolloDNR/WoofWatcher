import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { MIN_MOBILE_TOUCH_TARGET } from "./mobileLayout.ts";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function read(...parts: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...parts), "utf8");
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertSentOnlyAfterAwaitedDelivery(
  action: string,
  returnedErrorName: "sendError" | "resendError",
): void {
  const normalized = action.replace(/\s+/g, " ");
  const awaitCall = "await signUp.verifications.sendEmailCode()";
  const awaitIndex = normalized.indexOf(awaitCall);
  const sentIndex = normalized.indexOf('setEmailCodeDelivery("sent")');
  assert.notEqual(awaitIndex, -1, "the delivery request must be awaited");
  assert.ok(
    sentIndex > awaitIndex,
    'the truthful "sent" state must occur only after the awaited delivery request',
  );
  assert.doesNotMatch(
    normalized.slice(0, awaitIndex),
    /setEmailCodeDelivery\("sent"\)/,
    'the action must not claim "sent" before delivery resolves',
  );
  assert.match(
    normalized.slice(awaitIndex, sentIndex),
    new RegExp(
      `if \\(${returnedErrorName}\\) \\{[^}]*setEmailCodeDelivery\\("failed"\\)[^}]*return;[^}]*\\}`,
    ),
    "a returned delivery failure must exit before the sent state",
  );
}

test("the delivery-order assertion rejects a premature sent state", () => {
  assert.throws(() =>
    assertSentOnlyAfterAwaitedDelivery(
      `
        setEmailCodeDelivery("sent");
        const { error: sendError } =
          await signUp.verifications.sendEmailCode();
        if (sendError) {
          setEmailCodeDelivery("failed");
          return;
        }
      `,
      "sendError",
    ),
  );
});

test("Setup fields expose their visible labels and Finish later keeps a 48-point target", () => {
  const setup = read("app", "setup.tsx");
  const field = sourceBetween(setup, "function Field({", "const s = StyleSheet.create");

  assert.match(field, /<TextInput[\s\S]*accessibilityLabel=\{label\}/);
  assert.match(
    setup,
    /laterBtn:\s*\{[\s\S]{0,160}minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
  assert.doesNotMatch(setup, /laterBtn:\s*\{[^}]*\bheight:\s*42\b/);
});

test("Setup keeps an incomplete save actionable and lets progress labels wrap", () => {
  const setup = read("app", "setup.tsx");
  const saveAction = sourceBetween(
    setup,
    '<View style={s.actions}>',
    '{(!canSave || !setupLoaded) && saveBlockedMessage',
  );
  const progressSteps = sourceBetween(
    setup,
    '<View style={s.stepGrid}>',
    '</BoardCard>',
  );

  assert.match(saveAction, /disabled=\{controlsDisabled\}/);
  assert.match(
    saveAction,
    /accessibilityState=\{\{ disabled: controlsDisabled \}\}/,
  );
  assert.doesNotMatch(saveAction, /disabled:\s*!canSave/);
  assert.doesNotMatch(saveAction, /aria-disabled=\{!canSave/);
  assert.match(saveAction, /accessibilityHint=\{canSave \? undefined : saveBlockedMessage\}/);

  assert.doesNotMatch(progressSteps, /numberOfLines=\{1\}/);
  assert.match(setup, /stepItem:\s*\{[\s\S]{0,180}alignItems:\s*"flex-start"/);
  assert.match(
    setup,
    /stepText:\s*\{[\s\S]{0,120}flex:\s*1[\s\S]{0,120}lineHeight:/,
  );
});

test("password sign-in reports provider failures and serializes every sign-in action", () => {
  const signIn = read("app", "(auth)", "sign-in.tsx");
  const submit = sourceBetween(
    signIn,
    "const handleSubmit = async",
    "const handleGoogle = useCallback",
  );
  const google = sourceBetween(
    signIn,
    "const handleGoogle = useCallback",
    "return (",
  );

  assert.match(signIn, /type SignInAction = "password" \| "google"/);
  assert.match(
    signIn,
    /const actionGateRef = useRef<SignInAction \| null>\(null\)/,
  );
  assert.match(
    signIn,
    /const \[activeAction, setActiveAction\] = useState<SignInAction \| null>\(null\)/,
  );
  assert.match(signIn, /const busy = providerBusy \|\| activeAction !== null/);
  assert.match(
    signIn,
    /const PASSWORD_SIGN_IN_FAILURE =\s*"We couldn't sign you in\. Check your email and password, then try again\."/,
  );
  assert.match(
    signIn,
    /const SESSION_ACTIVATION_FAILURE =\s*"Your details were accepted, but we couldn't start your account session\. Check your connection, then try again\."/,
  );

  for (const [action, actionName] of [
    [submit, "password"],
    [google, "google"],
  ] as const) {
    assert.match(action, /if \(busy \|\| actionGateRef\.current !== null\) return/);
    assert.match(action, new RegExp(`actionGateRef\\.current = "${actionName}"`));
    assert.match(action, new RegExp(`setActiveAction\\("${actionName}"\\)`));
    assert.match(action, /finally\s*\{[\s\S]*actionGateRef\.current = null[\s\S]*setActiveAction\(null\)/);
  }

  assert.match(submit, /try\s*\{[\s\S]*await signIn\.password/);
  assert.match(
    submit,
    /if \(error\) \{[\s\S]*setFormError\(PASSWORD_SIGN_IN_FAILURE\)[\s\S]*return/,
  );
  assert.match(
    submit,
    /catch\s*\{\s*setFormError\(PASSWORD_SIGN_IN_FAILURE\);\s*return;\s*\}/,
  );
  assert.match(
    submit,
    /const \{ error: finalizeError \} = await signIn\.finalize\(\{/,
  );
  assert.match(
    submit,
    /if \(finalizeError\) \{[\s\S]*setFormError\(SESSION_ACTIVATION_FAILURE\)[\s\S]*return/,
  );
  assert.match(
    submit,
    /catch\s*\{\s*setFormError\(SESSION_ACTIVATION_FAILURE\);\s*return;\s*\}/,
  );
  assert.doesNotMatch(signIn, /\.(?:message|longMessage)\b/);
  assert.match(
    google,
    /catch\s*\{[\s\S]*setFormError\(GOOGLE_SIGN_IN_FAILURE\)/,
  );

  assert.match(signIn, /editable=\{!busy\}/);
  assert.match(
    signIn,
    /label="Sign in"[\s\S]{0,220}loading=\{activeAction === "password"\}[\s\S]{0,120}disabled=\{!emailAddress \|\| !password \|\| busy\}/,
  );
  assert.match(
    signIn,
    /<GoogleButton\s+onPress=\{handleGoogle\}\s+loading=\{activeAction === "google"\}\s+disabled=\{busy\}/,
  );
});

test("Setup's success sheet disables its slide transition under Reduce Motion", () => {
  const setup = read("app", "setup.tsx");
  const successModal = sourceBetween(
    setup,
    "{/* Save celebration:",
    "function Section({",
  );

  assert.match(
    setup,
    /import \{ useReducedMotion \} from "react-native-reanimated"/,
  );
  assert.match(setup, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(
    successModal,
    /animationType=\{reducedMotion \? "none" : "slide"\}/,
  );
  assert.doesNotMatch(successModal, /animationType="slide"/);
});

test("Setup's success sheet stays scrollable and its actions grow at large text", () => {
  const setup = read("app", "setup.tsx");
  const successModal = sourceBetween(
    setup,
    "{/* Save celebration:",
    "function Section({",
  );

  assert.match(
    successModal,
    /<ModalSheetPressable[\s\S]{0,260}style=\{s\.sheetSurface\}/,
  );
  assert.match(
    successModal,
    /<BoardCard[\s\S]{0,180}<ScrollView[\s\S]{0,180}style=\{s\.sheetScroll\}/,
  );
  assert.match(successModal, /contentContainerStyle=\{s\.sheetScrollContent\}/);
  assert.match(setup, /sheetSurface:\s*\{[\s\S]{0,120}maxHeight:\s*"96%"/);
  assert.match(setup, /sheetCard:\s*\{[\s\S]{0,120}flexShrink:\s*1/);
  assert.match(setup, /sheetScroll:\s*\{[\s\S]{0,100}flexShrink:\s*1/);
  assert.match(
    setup,
    /saveBtn:\s*\{[\s\S]{0,180}minHeight:\s*54[\s\S]{0,160}paddingVertical:/,
  );
  assert.doesNotMatch(setup, /saveBtn:\s*\{[^}]*\bheight:\s*54\b/);
  assert.match(
    setup,
    /saveText:\s*\{[\s\S]{0,120}flexShrink:\s*1[\s\S]{0,100}lineHeight:/,
  );
});

test("sign-in secondary navigation owns a full link target", () => {
  const signIn = read("app", "(auth)", "sign-in.tsx");
  const createAccount = sourceBetween(
    signIn,
    '<Link href="/(auth)/sign-up" asChild>',
    "</Link>",
  );

  assert.match(createAccount, /<Pressable/);
  assert.match(createAccount, /accessibilityRole="link"/);
  assert.match(createAccount, /accessibilityLabel="Create an account"/);
  assert.match(createAccount, /styles\.footerLinkButton/);
  assert.match(
    signIn,
    /footerLinkButton:\s*\{[\s\S]{0,140}minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
});

test("email sign-up actions surface returned and thrown failures, then recover", () => {
  const signUp = read("app", "(auth)", "sign-up.tsx");
  const submit = sourceBetween(signUp, "const handleSubmit = async", "const handleVerify = async");
  const verify = sourceBetween(signUp, "const handleVerify = async", "const handleResend = async");
  const resend = sourceBetween(signUp, "const handleResend = async", "const handleGoogle = useCallback");
  const google = sourceBetween(
    signUp,
    "const handleGoogle = useCallback",
    "const awaitingCode",
  );

  assert.match(signUp, /type EmailAction = "create" \| "verify" \| "resend"/);
  assert.match(signUp, /type SignUpAction = EmailAction \| "google"/);
  assert.match(signUp, /const \[emailAction, setEmailAction\] = useState<EmailAction \| null>\(null\)/);
  assert.match(
    signUp,
    /const actionGateRef = useRef<SignUpAction \| null>\(null\)/,
  );

  assert.match(submit, /setEmailAction\("create"\)/);
  assert.match(submit, /actionGateRef\.current = "create"/);
  assert.match(
    submit,
    /const \{ error: sendError \} =\s*await signUp\.verifications\.sendEmailCode\(\)/,
  );
  assert.match(submit, /if \(sendError\)[\s\S]*setFormError[\s\S]*return/);
  assert.match(
    submit,
    /catch\s*\{[\s\S]*setEmailCodeDelivery\("failed"\)[\s\S]*setFormError\(EMAIL_CODE_SEND_FAILURE\)/,
  );
  assert.match(
    signUp,
    /const EMAIL_CODE_SEND_FAILURE =\s*"Your account is ready, but we couldn't send the verification code\. Check your connection, then try Resend code\."/,
  );
  assert.match(
    submit,
    /finally\s*\{[\s\S]*actionGateRef\.current = null[\s\S]*setEmailAction\(null\)/,
  );

  assert.match(verify, /setEmailAction\("verify"\)/);
  assert.match(verify, /actionGateRef\.current = "verify"/);
  assert.match(
    verify,
    /const \{ error: verificationError \} =\s*await signUp\.verifications\.verifyEmailCode\(\{ code \}\)/,
  );
  assert.match(verify, /if \(verificationError\)[\s\S]*setFormError[\s\S]*return/);
  assert.match(
    verify,
    /catch\s*\{\s*setFormError\(EMAIL_VERIFICATION_FAILURE\);\s*return;\s*\}/,
  );
  assert.match(
    verify,
    /finally\s*\{[\s\S]*actionGateRef\.current = null[\s\S]*setEmailAction\(null\)/,
  );

  assert.match(resend, /setEmailAction\("resend"\)/);
  assert.match(resend, /actionGateRef\.current = "resend"/);
  assert.match(
    resend,
    /const \{ error: resendError \} =\s*await signUp\.verifications\.sendEmailCode\(\)/,
  );
  assert.match(resend, /if \(resendError\)[\s\S]*setFormError[\s\S]*return/);
  assert.match(resend, /catch[\s\S]*new code[\s\S]*try again/i);
  assert.match(
    resend,
    /finally\s*\{[\s\S]*actionGateRef\.current = null[\s\S]*setEmailAction\(null\)/,
  );

  for (const action of [submit, verify, resend, google]) {
    assert.match(
      action,
      /if \(busy \|\| actionGateRef\.current !== null\) return/,
    );
  }
  assert.match(google, /actionGateRef\.current = "google"/);
  assert.match(
    google,
    /finally\s*\{[\s\S]*actionGateRef\.current = null[\s\S]*setSsoLoading\(false\)/,
  );
  assert.match(
    signUp,
    /const busy = providerBusy \|\| emailAction !== null \|\| ssoLoading/,
  );
  assert.match(
    signUp,
    /accessibilityLabel="Resend verification code"[\s\S]{0,240}disabled=\{busy\}/,
  );
  assert.doesNotMatch(
    signUp,
    /onPress=\{\(\) => signUp\.verifications\.sendEmailCode\(\)\}/,
  );
  assert.doesNotMatch(signUp, /\.(?:message|longMessage)\b/);
  assert.match(
    google,
    /catch\s*\{[\s\S]*setFormError\(GOOGLE_SIGN_UP_FAILURE\)/,
  );
});

test("email verification distinguishes returned and thrown finalize failures", () => {
  const signUp = read("app", "(auth)", "sign-up.tsx");
  const verify = sourceBetween(
    signUp,
    "const handleVerify = async",
    "const handleResend = async",
  );

  assert.match(
    verify,
    /const \{ error: finalizeError \} =\s*await signUp\.finalize\(\{/,
  );
  assert.match(
    verify,
    /if \(finalizeError\) \{[\s\S]*setFormError\(SIGN_UP_SESSION_ACTIVATION_FAILURE\)[\s\S]*return;/,
  );
  assert.match(
    verify,
    /catch\s*\{\s*setFormError\(SIGN_UP_SESSION_ACTIVATION_FAILURE\);\s*return;\s*\}/,
  );
  assert.match(
    signUp,
    /const SIGN_UP_SESSION_ACTIVATION_FAILURE =\s*"We verified your email, but couldn't start your account session\. Check your connection, then try again\."/,
  );
  assert.match(
    verify,
    /else \{\s*setFormError\(ADDITIONAL_SIGN_UP_REQUIREMENTS\);\s*\}/,
  );
  assert.doesNotMatch(
    verify,
    /That code didn't work/,
    "a successful verification must not be relabelled as a bad code",
  );
});

test("Google auth exposes action-specific busy state without marking sibling work as Google loading", () => {
  const signIn = read("app", "(auth)", "sign-in.tsx");
  const signUp = read("app", "(auth)", "sign-up.tsx");
  const authUi = read("components", "auth-ui.tsx");

  assert.match(
    signIn,
    /<GoogleButton\s+onPress=\{handleGoogle\}\s+loading=\{activeAction === "google"\}\s+disabled=\{busy\}/,
  );
  assert.match(
    signUp,
    /<GoogleButton\s+onPress=\{handleGoogle\}\s+loading=\{ssoLoading\}\s+disabled=\{busy\}/,
  );
  assert.match(
    authUi,
    /accessibilityState=\{\{\s*disabled: isDisabled,\s*busy: Boolean\(loading\),?\s*\}\}/,
  );
  assert.match(
    authUi,
    /accessibilityLabel=\{\s*loading \? "Connecting to Google" : "Continue with Google"\s*\}/,
  );
  assert.match(authUi, /loading \? "Connecting to Google…" : "Continue with Google"/);
  assert.match(
    authUi,
    /googleText:\s*\{[\s\S]{0,140}flexShrink:\s*1[\s\S]{0,100}textAlign:\s*"center"/,
  );
  const primaryButton = sourceBetween(
    authUi,
    "export function PrimaryButton({",
    "export function LocalPreviewGateway",
  );
  assert.match(
    primaryButton,
    /accessibilityState=\{\{\s*disabled: Boolean\(isDisabled\),\s*busy: Boolean\(loading\),?\s*\}\}/,
  );
});

test("auth footer links wrap without losing their full touch targets", () => {
  for (const screen of ["sign-in.tsx", "sign-up.tsx"]) {
    const source = read("app", "(auth)", screen);
    assert.match(
      source,
      /footer:\s*\{[\s\S]{0,180}flexWrap:\s*"wrap"/,
      `${screen} footer should wrap at large text sizes`,
    );
    assert.match(
      source,
      /footerLinkButton:\s*\{[\s\S]{0,140}minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
    );
    assert.match(
      source,
      /footerText:\s*\{[\s\S]{0,100}flexShrink:\s*1/,
    );
  }
});

test("email verification copy reflects delivery without duplicating the failure alert", () => {
  const signUp = read("app", "(auth)", "sign-up.tsx");
  const deliveryCopy = sourceBetween(
    signUp,
    "function getVerificationSubtitle(",
    "export default function SignUpScreen",
  );
  const sendingCopy = sourceBetween(
    deliveryCopy,
    'case "sending":',
    'case "sent":',
  );
  const sentCopy = sourceBetween(
    deliveryCopy,
    'case "sent":',
    'case "failed":',
  );
  const failedCopy = sourceBetween(
    deliveryCopy,
    'case "failed":',
    "default:",
  );
  const submit = sourceBetween(
    signUp,
    "const handleSubmit = async",
    "const handleVerify = async",
  );
  const resend = sourceBetween(
    signUp,
    "const handleResend = async",
    "const handleGoogle = useCallback",
  );

  assert.match(
    signUp,
    /type EmailCodeDelivery = "idle" \| "sending" \| "sent" \| "failed"/,
  );
  assert.match(signUp, /function getVerificationTitle\(/);
  assert.match(signUp, /case "sending":[\s\S]{0,100}Sending your code/);
  assert.match(signUp, /case "failed":[\s\S]{0,100}Send a verification code/);
  assert.match(sendingCopy, /We're sending a verification code/);
  assert.doesNotMatch(sendingCopy, /We sent a verification code/);
  assert.match(sentCopy, /We sent a verification code/);
  assert.match(failedCopy, /Verify \$\{emailAddress\}/i);
  assert.doesNotMatch(failedCopy, /Your account is ready/i);
  assert.doesNotMatch(failedCopy, /couldn't send/i);
  assert.doesNotMatch(failedCopy, /We sent a verification code/);

  for (const action of [submit, resend]) {
    assert.match(action, /setEmailCodeDelivery\("sending"\)/);
    assert.match(action, /setEmailCodeDelivery\("sent"\)/);
    assert.match(action, /setEmailCodeDelivery\("failed"\)/);
  }
  assertSentOnlyAfterAwaitedDelivery(submit, "sendError");
  assertSentOnlyAfterAwaitedDelivery(resend, "resendError");
  assert.match(
    signUp,
    /subtitle=\{getVerificationSubtitle\(emailCodeDelivery, emailAddress\)\}/,
  );
  assert.match(
    signUp,
    /title=\{getVerificationTitle\(emailCodeDelivery\)\}/,
  );
});

test("sign-up secondary navigation owns a full link target", () => {
  const signUp = read("app", "(auth)", "sign-up.tsx");
  const signIn = sourceBetween(
    signUp,
    '<Link href="/(auth)/sign-in" asChild>',
    "</Link>",
  );

  assert.match(signIn, /<Pressable/);
  assert.match(signIn, /accessibilityRole="link"/);
  assert.match(signIn, /accessibilityLabel="Sign in"/);
  assert.match(signIn, /styles\.footerLinkButton/);
  assert.match(
    signUp,
    /footerLinkButton:\s*\{[\s\S]{0,140}minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
});

test("shared auth fields use the visible label unless an accessibility label is overridden", () => {
  const authUi = read("components", "auth-ui.tsx");
  const field = sourceBetween(
    authUi,
    "export function Field({",
    "export function PrimaryButton({",
  );

  assert.match(
    field,
    /label,\s*error,\s*accessibilityLabel,\s*\.\.\.props/,
  );
  assert.match(
    field,
    /<TextInput[\s\S]*accessibilityLabel=\{accessibilityLabel \?\? label\}/,
  );
});

test("Premium leaves its route entrance to the shared Reduce Motion-aware navigator", () => {
  const premium = read("app", "premium.tsx");
  const navigator = read("app", "_layout.tsx");

  assert.match(navigator, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(
    navigator,
    /screenOptions=\{\{[\s\S]{0,160}animation:\s*reducedMotion \? "none" : "default"/,
  );
  assert.doesNotMatch(premium, /useReducedMotion|MOTION_MS|SPRING|enterUp/);
  assert.doesNotMatch(premium, /const (?:fade|slide) =/);
  assert.doesNotMatch(premium, /<BoardCard[^>]*\senter=\{\d+\}/);
});

test("Board section headers allow titles and accessories to wrap at large text sizes", () => {
  const board = read("components", "board", "BoardPrimitives.tsx");
  const header = sourceBetween(
    board,
    "export function BoardSectionHeader({",
    "export function StatusMeter({",
  );

  assert.equal(MIN_MOBILE_TOUCH_TARGET, 48);
  assert.doesNotMatch(header, /numberOfLines=\{1\}/);
  assert.doesNotMatch(header, /<View style=\{styles\.sectionAccessory\}>/);
  assert.match(header, /React\.isValidElement<PressableProps>\(accessory\)/);
  assert.match(header, /accessory\.type === Pressable/);
  assert.match(header, /styles\.sectionAccessoryTarget/);
  assert.match(board, /sectionHeader:\s*\{[\s\S]{0,180}flexWrap:\s*"wrap"/);
  assert.match(
    board,
    /sectionAccessoryTarget:\s*\{[\s\S]{0,180}minWidth:\s*MIN_MOBILE_TOUCH_TARGET[\s\S]{0,100}minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
  );
  assert.match(board, /pillText:\s*\{[\s\S]{0,100}flexShrink:\s*1/);
});
