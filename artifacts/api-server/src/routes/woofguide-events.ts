import { Router, type IRouter, type Request, type Response } from "express";
// @ts-ignore — vanilla JS module, no types
import { createWoofguideEvents, getWoofguideEventsStatus } from "../woofguide-events.js";
import { requireAuth } from "../lib/auth";
import { makeRateLimiter } from "../lib/rateLimit";

const rateLimited = makeRateLimiter({ maxPerWindow: 8, globalMaxPerWindow: 60 });

const router: IRouter = Router();

router.get("/woofguide-events", requireAuth, (_req: Request, res: Response) => {
  res.json(getWoofguideEventsStatus(process.env));
});

router.post("/woofguide-events", requireAuth, async (req: Request, res: Response) => {
  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Too many requests. Try again in a moment." });
    return;
  }
  try {
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const result = await createWoofguideEvents({
      location: body.location,
      profile: body.profile,
      env: process.env,
    });
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    req.log?.error({ err }, "woofguide-events failed");
    res.status(502).json({ error: err.message });
  }
});

export default router;
