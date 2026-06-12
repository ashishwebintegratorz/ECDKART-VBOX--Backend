import express from "express";
import {
  getZones,
  createZone,
  updateZone,
  deleteZone
} from "../controllers/zone.controller.js";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = express.Router();

router.use(jwtAuth);
router.use(requireRole("admin"));

router.route("/")
  .get(getZones)
  .post(createZone);

router.route("/:id")
  .put(updateZone)
  .delete(deleteZone);

export default router;
