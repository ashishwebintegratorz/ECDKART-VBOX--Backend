import { Router } from "express";
import * as authCtrl from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  sendOtpSchema,
  verifyOtpSchema,
  loginWithPinSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";

import rateLimit from "express-rate-limit";

const router = Router();

router.post("/send-otp", validate(sendOtpSchema), authCtrl.sendOtp);
router.post("/verify-otp", validate(verifyOtpSchema), authCtrl.verifyOtpController);
router.post(
  "/login-with-pin",
  validate(loginWithPinSchema),
  authCtrl.loginWithPin
);
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  authCtrl.refreshTokenController
);
import jwtAuth from "../middlewares/jwtAuth.middleware.js";

router.post("/refresh", authCtrl.refreshAccessToken);
router.post("/logout", jwtAuth, authCtrl.logoutUser);

export default router;
