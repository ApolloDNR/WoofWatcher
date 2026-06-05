import { Router, type IRouter, type Request, type Response } from "express";
// @ts-ignore — vanilla JS module, no types
import { createOpenAICareAnswer, getOpenAIStatus } from "../openai-care-helper.js";

const router: IRouter = Router();

router.get("/care-helper", (_req: Request, res: Response) => {
  const status = getOpenAIStatus(process.env);
  res.json({
    ...status,
    mode: status.configured ? "openai" : "local"
  });
});

router.post("/care-helper", async (req: Request, res: Response) => {
  const status = getOpenAIStatus(process.env);

  if (!status.configured) {
    res.status(501).json({
      error: "OPENAI_API_KEY is not configured.",
      mode: "local",
      boundary: status.boundary
    });
    return;
  }

  try {
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const answer = await createOpenAICareAnswer({
      question: body.question,
      context: body.context,
      env: process.env
    });
    res.json(answer);
  } catch (error: unknown) {
    const err = error as Error & { code?: string; status?: number };
    res.status(502).json({
      error: err.message,
      mode: "local",
      boundary: status.boundary
    });
  }
});

export default router;
