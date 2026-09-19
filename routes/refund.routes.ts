import { Router } from "express";
import { getRefunds, processRefund } from "../controllers/refund.controller.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", jwtAuth, requireRole("admin"), getRefunds);
router.put("/:id/process", jwtAuth, requireRole("admin"), processRefund);

export default router;
