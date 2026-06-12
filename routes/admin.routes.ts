import { Router } from "express";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { getDashboardMetrics } from "../controllers/admin.controller.js";

const router = Router();

router.get(
    "/dashboard",
    jwtAuth,
    requireRole("admin"),
    getDashboardMetrics
);

export default router;
