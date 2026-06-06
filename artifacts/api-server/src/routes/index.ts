import { Router, type IRouter } from "express";
import healthRouter from "./health";
import careHelperRouter from "./care-helper";
import avatarRouter from "./avatar";
import householdRouter from "./household";
import careStateRouter from "./care-state";
import careEntriesRouter from "./care-entries";
import woofguideEventsRouter from "./woofguide-events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(careHelperRouter);
router.use(avatarRouter);
router.use(householdRouter);
router.use(careStateRouter);
router.use(careEntriesRouter);
router.use(woofguideEventsRouter);

export default router;
