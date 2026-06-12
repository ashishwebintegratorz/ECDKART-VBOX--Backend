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
    onboardDriver,
    getDriverSummary,
    getDriverDetails,
    updateDriverDetails,
    deleteDriver
} from "../controllers/driver.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Admin Routes
router.get("/all", jwtAuth, requireRole("admin"), getAllDrivers);
router.get("/free", jwtAuth, requireRole("admin"), getFreeDrivers);
router.get("/:id", jwtAuth, requireRole("admin"), getDriverDetails);
router.put("/:id", jwtAuth, requireRole("admin"), updateDriverDetails);
router.delete("/:id", jwtAuth, requireRole("admin"), deleteDriver);

// Driver Routes
router.put("/toggle-online", jwtAuth, requireRole("driver"), toggleOnlineStatus);
router.put("/reached-store", jwtAuth, requireRole("driver"), markReachedStoreStatus);
router.get("/route", jwtAuth, requireRole("driver"), getDriverRoute);
router.get("/summary", jwtAuth, requireRole("driver"), getDriverSummary);
router.post("/complete-delivery", jwtAuth, requireRole("driver"), completeDelivery);
router.post("/onboard", jwtAuth, upload.single("drivingLicense"), onboardDriver);

export default router;
