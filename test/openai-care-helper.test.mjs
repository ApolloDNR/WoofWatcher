import test from "node:test";
import assert from "node:assert/strict";

import {
  CARE_HELPER_BOUNDARY,
  buildCareHelperInput,
  compactAssistantContext,
  createOpenAICareAnswer,
  ensureVeterinaryBoundary,
  extractOpenAIText,
  getOpenAIStatus,
  isOpenAIConfigured
} from "../src/openai-care-helper.js";
import { getAssistantContext, getDefaultState } from "../src/woof-core.js";

test("reports OpenAI status without exposing secrets", () => {
  assert.equal(isOpenAIConfigured({}), false);
  assert.equal(isOpenAIConfigured({ OPENAI_API_KEY: "sk-test" }), true);

  const status = getOpenAIStatus({ OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-test" });
  assert.equal(status.configured, true);
  assert.equal(status.model, "gpt-test");
  assert.equal(Object.values(status).includes("sk-test"), false);
});

test("compacts Phoenix context before sending it to OpenAI", () => {
  const context = getAssistantContext(getDefaultState("2026-06-03T18:00:00.000Z"), "What happened?");
  const compact = compactAssistantContext(context);

  assert.equal(compact.profile.name, "Phoenix");
  assert.equal(compact.handoff.nextRoutine.label, "Midday check");
  assert.match(compact.handoff.message, /Next Phoenix care/);
  assert.equal(compact.latest.length <= 5, true);
  assert.equal("localAnswer" in compact, false);
});

test("builds a safe care helper input with question and compact context", () => {
  const context = getAssistantContext(getDefaultState("2026-06-03T18:00:00.000Z"), "Yellow bile again?");
  const input = buildCareHelperInput({ question: "Yellow bile again?", context });

  assert.match(input, /Question: Yellow bile again/);
  assert.match(input, /Phoenix context/);
  assert.match(input, /"healthWatch"/);
});

test("extracts text from common Responses API output shapes", () => {
  assert.equal(extractOpenAIText({ output_text: "Direct text" }), "Direct text");
  assert.equal(
    extractOpenAIText({
      output: [
        {
          content: [{ type: "output_text", text: "Nested text" }]
        }
      ]
    }),
    "Nested text"
  );
});

test("enforces the veterinarian boundary on short model answers", () => {
  const answer = ensureVeterinaryBoundary("Track the timing and appetite.");
  assert.match(answer, /Track the timing/);
  assert.match(answer, /veterinarian|urgent care/i);
});

test("calls the Responses API with server-side key and returns bounded answer", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      headers: { get: () => "req_test" },
      json: async () => ({
        id: "resp_test",
        output_text: "Track Phoenix's last meal time, vomit timing, energy, stool, and appetite."
      })
    };
  };

  const context = getAssistantContext(getDefaultState("2026-06-03T18:00:00.000Z"), "Yellow bile again?");
  const result = await createOpenAICareAnswer({
    question: "Yellow bile again?",
    context,
    env: { OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-test" },
    fetchImpl: fakeFetch
  });

  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.headers.Authorization, "Bearer sk-test");
  assert.equal(JSON.parse(request.options.body).model, "gpt-test");
  assert.equal(result.mode, "openai");
  assert.equal(result.requestId, "req_test");
  assert.match(result.answer, /Phoenix/);
  assert.match(result.answer, /veterinarian|urgent care/i);
});

test("missing OpenAI key throws a specific integration error", async () => {
  await assert.rejects(
    () =>
      createOpenAICareAnswer({
        question: "Can you help?",
        context: {},
        env: {},
        fetchImpl: async () => ({})
      }),
    { code: "missing_openai_key" }
  );
});

test("boundary constant contains urgent veterinary language", () => {
  assert.match(CARE_HELPER_BOUNDARY, /urgent/i);
  assert.match(CARE_HELPER_BOUNDARY, /veterinarian/i);
});
