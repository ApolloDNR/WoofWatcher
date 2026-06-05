import { Router, type IRouter } from "express";
import healthRouter from "./health";
import careHelperRouter from "./care-helper";

const router: IRouter = Router();

router.use(healthRouter);
router.use(careHelperRouter);

export default router;
