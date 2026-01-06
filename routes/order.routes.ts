import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js"; // user auth
//import { authDriver } from "../middlewares/driverAuth.middleware.js"; // if you separate drivers
import {
  createOrder, verifyPayment, getInvoiceByOrder, getMyInvoices, getMyOrders, getOrderById, cancelOrder, updateOrderStatus, getAllOrders,
  assignOrderToDriver, getDriverOrders, updateOrderByDriver
} from "../controllers/orders.controller.js";
import { requireRole } from "../middlewares/role.middleware.js";
const router = Router();

// 🟢 Create Order

router.post(
  "/create",
  jwtAuth,
  asyncHandler(createOrder)
);
router.post(
  "/verify-payment",
  jwtAuth,
  asyncHandler(verifyPayment)
);

router.get(
  "/invoice/:orderId",
  jwtAuth,
  asyncHandler(getInvoiceByOrder)
);

router.get(
  "/my-invoices",
  jwtAuth,
  asyncHandler(getMyInvoices)
);

router.get(
  "/my-orders",
  jwtAuth,
  asyncHandler(getMyOrders)
);

router.get(
  "/:orderId",
  jwtAuth,
  asyncHandler(getOrderById)
);

router.put(
  "/cancel/:orderId",
  jwtAuth,
  asyncHandler(cancelOrder)
);

router.put(
  "/update-status/:orderId",
  jwtAuth,
  requireRole("admin"),
  asyncHandler(updateOrderStatus)
);

router.get(
  "/all",
  jwtAuth,
  requireRole("admin"),
  asyncHandler(getAllOrders)
);

// --- Driver & Admin Assignment Routes ---

// Admin: Assign driver to order
router.put(
  "/assign-driver/:orderId",
  jwtAuth,
  requireRole("admin"),
  asyncHandler(assignOrderToDriver)
);

// Driver: Get my orders
router.get(
  "/driver/my-orders",
  jwtAuth,
  requireRole("driver"),
  asyncHandler(getDriverOrders)
);

// Driver: Update order status
router.put(
  "/driver/update-status/:orderId",
  jwtAuth,
  requireRole("driver"),
  asyncHandler(updateOrderByDriver)
);

export default router;