import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";


import {
  createOrder,
  getAllOrders,
  getMyOrders,
  getDriverOrders,
  getOrderById,
  assignDriver,
  cancelOrder,
  updateOrderStatus,
} from "../controllers/orders.controller.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

// ---------- Customer ----------
router.post("/create", jwtAuth ,requireRole("customer"), asyncHandler(createOrder));
router.get("/mine", jwtAuth ,requireRole("customer"), asyncHandler(getMyOrders));
router.patch("/:id/cancel", jwtAuth , asyncHandler(cancelOrder));

// ---------- Driver ----------
router.get("/driver/orders", jwtAuth ,requireRole("driver"), asyncHandler(getDriverOrders));

// ---------- Admin / Management ----------
router.get("/all", jwtAuth , asyncHandler(getAllOrders));
router.patch("/:id/status", jwtAuth , asyncHandler(updateOrderStatus));
router.post("/assign-driver", jwtAuth , asyncHandler(assignDriver));

// ---------- Common ----------
router.get("/:id", jwtAuth , asyncHandler(getOrderById));

export default router;
