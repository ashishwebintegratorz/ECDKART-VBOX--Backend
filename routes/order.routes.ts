import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js"; // user auth
//import { authDriver } from "../middlewares/driverAuth.middleware.js"; // if you separate drivers
import {
  createOrder, verifyPayment, getInvoiceByOrder, getMyInvoices
} from "../controllers/orders.controller.js";
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

export default router;