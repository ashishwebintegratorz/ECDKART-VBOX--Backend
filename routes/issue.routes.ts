import { Router } from "express";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { createIssue, getAllIssues, resolveIssue } from "../controllers/issue.controller.js";

const router = Router();

// User route to create issue
router.post("/", jwtAuth, createIssue);

// Admin route to get all issues
router.get("/admin", jwtAuth, requireRole("admin"), getAllIssues);

// Admin route to resolve issue
router.put("/:id/resolve", jwtAuth, requireRole("admin"), resolveIssue);

export default router;
