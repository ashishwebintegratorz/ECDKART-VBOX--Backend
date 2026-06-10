import { Router } from "express";
import multer from "multer";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import {
    getAllDrivers,
    getFreeDrivers,
    toggleOnlineStatus,
    markReachedStoreStatus,
    getDriverRoute,
    completeDelivery,
    onboardDriver
} from "../controllers/driver.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Admin Routes
router.get("/all", jwtAuth, requireRole("admin"), getAllDrivers);
router.get("/free", jwtAuth, requireRole("admin"), getFreeDrivers);

// Driver Routes
router.put("/toggle-online", jwtAuth, requireRole("driver"), toggleOnlineStatus);
router.put("/reached-store", jwtAuth, requireRole("driver"), markReachedStoreStatus);
router.get("/route", jwtAuth, requireRole("driver"), getDriverRoute);
router.post("/complete-delivery", jwtAuth, requireRole("driver"), completeDelivery);
router.post("/onboard", jwtAuth, upload.single("drivingLicense"), onboardDriver);

export default router;
