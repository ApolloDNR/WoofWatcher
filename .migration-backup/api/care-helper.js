import { createOpenAICareAnswer, getOpenAIStatus } from "../src/openai-care-helper.js";

export default async function handler(request, response) {
  const status = getOpenAIStatus(process.env);

  if (request.method === "GET") {
    response.status(200).json({
      ...status,
      mode: status.configured ? "openai" : "local"
    });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!status.configured) {
    response.status(501).json({
      error: "OPENAI_API_KEY is not configured.",
      mode: "local",
      boundary: status.boundary
    });
    return;
  }

  try {
    const body = typeof request.body === "object" && request.body ? request.body : {};
    const answer = await createOpenAICareAnswer({
      question: body.question,
      context: body.context,
      env: process.env
    });
    response.status(200).json(answer);
  } catch (error) {
    response.status(502).json({
      error: error.message,
      mode: "local",
      boundary: status.boundary
    });
  }
}
