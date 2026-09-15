import { Router } from "express";
import {
  addBanner,
  getAllBanners,
  getActiveBanners,
  updateBanner,
  deleteBanner,
} from "../controllers/banner.controller.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";

const router = Router();

// Public route for frontend app
router.get("/active", asyncHandler(getActiveBanners));

// Admin only routes
router.use(jwtAuth, requireRole("admin"));

router.post("/", upload.single("image"), asyncHandler(addBanner));
router.get("/", asyncHandler(getAllBanners));
router.put("/:id", upload.single("image"), asyncHandler(updateBanner));
router.delete("/:id", asyncHandler(deleteBanner));

export default router;
