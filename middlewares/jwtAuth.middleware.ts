import type { Request, Response, NextFunction } from "express";
import { UnauthorizedException } from "../utils/appError.js";
import { verifyAccessJwt } from "../utils/jwt.js";
import UserModel from "../models/User.model.js";

export const jwtAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      throw new UnauthorizedException("Missing authorization header");
    }

    const parts = header.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new UnauthorizedException("Invalid authorization format");
    }

    const token = parts[1];
    let payload: any;
    try {
      payload = verifyAccessJwt(token);
    } catch (jwtErr) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    let user;
    try {
      user = await UserModel.findById(payload.sub);
    } catch (e) {
      throw new UnauthorizedException("Invalid user id format");
    }

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.isBlocked) {
      throw new UnauthorizedException("Your account has been blocked by the admin.");
    }

    (req as any).user = user;
    next();
  } catch (err) {
    next(err);
  }
};
export default jwtAuth;