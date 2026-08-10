import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import producteursRouter from "./producteurs";
import cooperativesRouter from "./cooperatives";
import statsRouter from "./stats";
import storageRouter from "./storage";
import farmsRouter from "./farms";
import productionsRouter from "./productions";
import disponibilitesRouter from "./disponibilites";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(producteursRouter);
router.use(cooperativesRouter);
router.use(statsRouter);
router.use(storageRouter);
router.use(farmsRouter);
router.use(productionsRouter);
router.use(disponibilitesRouter);

export default router;
