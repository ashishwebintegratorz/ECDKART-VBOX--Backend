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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for auth
  message: "Too many login attempts from this IP, please try again after 15 minutes",
});

router.post("/send-otp", authLimiter, validate(sendOtpSchema), authCtrl.sendOtp);
router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), authCtrl.verifyOtpController);
router.post(
  "/login-with-pin",
  authLimiter,
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
