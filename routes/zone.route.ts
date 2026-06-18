import express from "express";
import {
  getZones,
  getActiveZones,
  checkServiceability,
  createZone,
  updateZone,
  deleteZone
} from "../controllers/zone.controller.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public route for fetching zones
router.route("/active")
  .get(getActiveZones);

router.route("/check-serviceability")
  .post(checkServiceability);

router.route("/")
  .get(getZones);

// Admin routes
router.use(jwtAuth);
router.use(requireRole("admin"));

router.route("/")
  .post(createZone);

router.route("/:id")
  .put(updateZone)
  .delete(deleteZone);

export default router;
