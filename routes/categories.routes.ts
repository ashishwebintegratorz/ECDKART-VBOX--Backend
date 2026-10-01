import { Router } from "express";
import {
  addCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/categories.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { upload } from "../middlewares/multer.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

// Public routes
router.get("/", asyncHandler(getAllCategories));
router.get("/:id", asyncHandler(getCategoryById));

// Admin routes
router.use(jwtAuth, requireRole("admin"));
router.post("/", upload.single("image"), asyncHandler(addCategory));
router.put("/:id", upload.single("image"), asyncHandler(updateCategory));
router.delete("/:id", asyncHandler(deleteCategory));

export default router;
