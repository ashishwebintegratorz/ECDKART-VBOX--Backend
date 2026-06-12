import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js"; // user auth
//import { authDriver } from "../middlewares/driverAuth.middleware.js"; // if you separate drivers
import {
  createOrder, verifyPayment, getMyOrders, getOrderById, cancelOrder, updateOrderStatus, getAllOrders,
  assignOrderToDriver, getDriverOrders, getActiveDriverOrders, getDriverOrderHistory, updateOrderByDriver,
  acceptOrderBroadcast, declineOrderBroadcast
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
  "/my-orders",
  jwtAuth,
  asyncHandler(getMyOrders)
);
router.get(
  "/all",
  jwtAuth,
  requireRole("admin"),
  asyncHandler(getAllOrders)
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

// Driver: Get active orders
router.get(
  "/driver/active",
  jwtAuth,
  requireRole("driver"),
  asyncHandler(getActiveDriverOrders)
);

// Driver: Get order history
router.get(
  "/driver/history",
  jwtAuth,
  requireRole("driver"),
  asyncHandler(getDriverOrderHistory)
);

// Driver: Update order status
router.put(
  "/driver/update-status/:orderId",
  jwtAuth,
  requireRole("driver"),
  asyncHandler(updateOrderByDriver)
);

// Driver: Accept broadcasted order
router.patch(
  "/driver/accept/:orderId",
  jwtAuth,
  requireRole("driver"),
  asyncHandler(acceptOrderBroadcast)
);

// Driver: Decline broadcasted order
router.patch(
  "/driver/decline/:orderId",
  jwtAuth,
  requireRole("driver"),
  asyncHandler(declineOrderBroadcast)
);

export default router;