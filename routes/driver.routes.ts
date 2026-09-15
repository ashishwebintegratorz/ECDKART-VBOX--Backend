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
    deleteDriver,
    updateDriverLocation,
    getDriverCODEstimate,
    adminSettleDriverCOD,
    getAllDriversCODEstimates,
    getWalletSummary,
    requestWithdrawal
} from "../controllers/driver.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Static Routes (Admin)
router.get("/all", jwtAuth, requireRole("admin"), getAllDrivers);
router.get("/free", jwtAuth, requireRole("admin"), getFreeDrivers);

// Static Routes (Driver)
router.put("/toggle-online", jwtAuth, requireRole("driver"), toggleOnlineStatus);
router.put("/update-location", jwtAuth, requireRole("driver"), updateDriverLocation);
router.put("/reached-store", jwtAuth, requireRole("driver"), markReachedStoreStatus);
router.get("/route", jwtAuth, requireRole("driver"), getDriverRoute);
router.get("/summary", jwtAuth, requireRole("driver"), getDriverSummary);
router.post("/complete-delivery", jwtAuth, requireRole("driver"), completeDelivery);
router.post("/onboard", jwtAuth, upload.single("drivingLicense"), onboardDriver);
router.get("/cod-estimate", jwtAuth, requireRole("driver"), getDriverCODEstimate);
router.get("/wallet", jwtAuth, requireRole("driver"), getWalletSummary);
router.post("/withdraw", jwtAuth, requireRole("driver"), requestWithdrawal);
router.get("/admin/cod-estimates", jwtAuth, requireRole("admin"), getAllDriversCODEstimates);

// Dynamic Parameter Routes (must be last to prevent intercepting static routes)
router.get("/:id", jwtAuth, requireRole("admin"), getDriverDetails);
router.put("/:id", jwtAuth, requireRole("admin"), updateDriverDetails);
router.delete("/:id", jwtAuth, requireRole("admin"), deleteDriver);
router.get("/:id/cod-estimate", jwtAuth, requireRole("admin"), getDriverCODEstimate);
router.post("/:id/settle-cod", jwtAuth, requireRole("admin"), adminSettleDriverCOD);

export default router;
