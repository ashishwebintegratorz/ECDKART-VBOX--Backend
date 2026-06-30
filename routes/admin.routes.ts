import { Router } from "express";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { getDashboardMetrics } from "../controllers/admin.controller.js";
import { upload } from "../middlewares/multer.js";
import { getUsersList, broadcastNotification, broadcastCoupon, getAllCoupons, updateCoupon, deleteCoupon, getAllNotifications, updateNotification, deleteNotification } from "../controllers/admin.controller.js";

const router = Router();

router.get(
    "/dashboard",
    jwtAuth,
    requireRole("admin"),
    getDashboardMetrics
);

router.get("/users-list", jwtAuth, requireRole("admin"), getUsersList);
router.post("/broadcast-notification", jwtAuth, requireRole("admin"), upload.single('image'), broadcastNotification);
router.post("/broadcast-coupon", jwtAuth, requireRole("admin"), upload.single('image'), broadcastCoupon);
router.get("/coupons", jwtAuth, requireRole("admin"), getAllCoupons);
router.put("/coupons/:id", jwtAuth, requireRole("admin"), upload.single('image'), updateCoupon);
router.delete("/coupons/:id", jwtAuth, requireRole("admin"), deleteCoupon);

router.get("/notifications", jwtAuth, requireRole("admin"), getAllNotifications);
router.put("/notifications/:id", jwtAuth, requireRole("admin"), upload.single('image'), updateNotification);
router.delete("/notifications/:id", jwtAuth, requireRole("admin"), deleteNotification);

export default router;
