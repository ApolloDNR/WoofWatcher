import { Router, type IRouter } from "express";
import healthRouter from "./health";
import careHelperRouter from "./care-helper";
import avatarRouter from "./avatar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(careHelperRouter);
router.use(avatarRouter);

export default router;
