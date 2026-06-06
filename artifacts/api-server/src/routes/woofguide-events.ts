import { Router, type IRouter, type Request, type Response } from "express";
// @ts-ignore — vanilla JS module, no types
import { createWoofguideEvents, getWoofguideEventsStatus } from "../woofguide-events.js";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/woofguide-events", requireAuth, (_req: Request, res: Response) => {
  res.json(getWoofguideEventsStatus(process.env));
});

router.post("/woofguide-events", requireAuth, async (req: Request, res: Response) => {
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
