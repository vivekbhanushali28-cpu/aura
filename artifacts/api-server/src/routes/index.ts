import { Router, type IRouter } from "express";
import healthRouter from "./health";
import itinerariesRouter from "./itineraries";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(itinerariesRouter);
router.use(openaiRouter);

export default router;
