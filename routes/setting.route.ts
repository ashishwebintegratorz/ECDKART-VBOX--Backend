import express from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { getSettings, updateSetting } from "../controllers/setting.controller.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public route to fetch all settings
router.get("/", asyncHandler(getSettings));

// Admin route to update a specific setting
router.put(
  "/:key",
  jwtAuth,
  requireRole("admin"),
  asyncHandler(updateSetting)
);

export default router;
