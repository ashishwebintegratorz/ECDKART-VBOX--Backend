import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { createAndSendOtp, verifyOtp } from "../services/otp.service.js";
import {
  findOrCreateUserByPhone,
  createAuthTokens,
  setUserPin,
} from "../services/auth.service.js";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../utils/appError.js";
import UserModel from "../models/User.model.js";
import { verifyRefreshJwt, signAccessJwt } from "../utils/jwt.js";

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, role } = req.body;
  if (!phone) throw new BadRequestException("Phone required");

  await createAndSendOtp(phone);

  return res.json({
    message: `OTP sent on WhatsApp (dummy) for ${role || "customer"} login`,
  });
});

/**
 * Verify OTP
 * - Customer: normal OTP login
 * - Driver/Admin: OTP + optional PIN set on first time
 */
export const verifyOtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const { phone, code, role, pin } = req.body;

    if (!phone || !code) {
      throw new BadRequestException("Phone and OTP code are required");
    }

    const verification = await verifyOtp(phone, code);
    if (!verification.ok) {
      throw new BadRequestException(verification.reason || "Invalid OTP");
    }

    const user = await findOrCreateUserByPhone(phone, role as any);

    const isDriverOrAdmin =
      user.role === "driver" ||
      user.role === "admin";

    if (isDriverOrAdmin && pin) {
      await setUserPin(user, pin);
    }

    const auth = createAuthTokens(user);

    return res.json({
      token: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
    });
  }
);

/**
 * Login with PIN (driver/admin)
 */
export const loginWithPin = asyncHandler(
  async (req: Request, res: Response) => {
    const { phone, pin } = req.body;

    let searchPhones = [phone];
    if (phone.startsWith("+91")) {
      searchPhones.push(phone.substring(3));
    } else if (!phone.startsWith("+")) {
      searchPhones.push(`+91${phone}`);
    }

    const user = await UserModel.findOne({ phone: { $in: searchPhones } });
    if (!user) throw new NotFoundException("User not found");

    if (user.role !== "driver" && user.role !== "admin") {
      throw new BadRequestException("PIN login is only for driver/admin");
    }

    const userPinHash = user.pinHash || user.get("password");

    if (!userPinHash) {
      throw new BadRequestException(
        "PIN not set. Login via OTP first to set PIN."
      );
    }

    let ok = false;
    // Handle existing legacy unhashed PINs
    if (!userPinHash.startsWith("$2b$")) {
      ok = pin === userPinHash;
      if (ok) {
        // Upgrade to bcrypt transparently
        const newHash = await bcrypt.hash(pin, 10);
        if (user.pinHash) user.pinHash = newHash;
        else user.set("password", newHash);
        await user.save();
      }
    } else {
      ok = await bcrypt.compare(pin, userPinHash);
    }

    if (!ok) throw new UnauthorizedException("Invalid PIN");

    const auth = createAuthTokens(user);

    return res.json({
      token: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
    });
  }
);

/**
 * Refresh token – returns new access + refresh + user
 */
export const refreshTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    let payload: any;
    try {
      payload = verifyRefreshJwt(refreshToken);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await UserModel.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const auth = createAuthTokens(user);

    return res.json({
      token: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
    });
  }
);

//refresh token controller
export const refreshAccessToken = async (req: Request, res: Response, next: Function) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    const payload = verifyRefreshJwt(refreshToken);

    const user = await UserModel.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = signAccessJwt({
      sub: user._id.toString(),
      role: user.role,
    });

    return res.json({ token: newAccessToken });
  } catch (err) {
    next(err);
  }
};

export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user) {
    user.tokenIssuedAt = Math.floor(Date.now() / 1000);
    await user.save();
  }
  res.status(200).json({ success: true, message: "Logged out successfully" });
});