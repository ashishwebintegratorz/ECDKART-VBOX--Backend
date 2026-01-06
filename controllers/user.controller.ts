import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import UserModel from "../models/User.model.js";
import OrderModel from "../models/Order.model.js";

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  return res.json({ user });
});

export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { name } = req.body;
    user.name = name || user.name;
    await user.save();
    return res.json({ user });
  }
);

export const getDrivers = asyncHandler(async (req: Request, res: Response) => {
  const drivers = await UserModel.find({ role: "driver" }).select("name phone email avatar isOnline isReturning");

  // Enhance driver data with "busy" status
  const enhancedDrivers = await Promise.all(drivers.map(async (driver) => {
    const activeOrder = await OrderModel.findOne({
      assignedDriver: driver._id,
      deliveryStatus: { $in: ["assigned", "out_for_delivery"] }
    });
    return {
      ...driver.toObject(),
      isBusy: !!activeOrder
    };
  }));

  return res.json(enhancedDrivers);
});

export const toggleDriverOnlineStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { isOnline } = req.body;

  if (typeof isOnline !== "boolean") {
    return res.status(400).json({ message: "isOnline boolean is required" });
  }

  const updatedUser = await UserModel.findByIdAndUpdate(
    user.id,
    { isOnline },
    { new: true }
  );

  return res.json({ message: `Status updated to ${isOnline ? "Online" : "Offline"}`, user: updatedUser });
});

export const markReachedStore = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const updatedUser = await UserModel.findByIdAndUpdate(
    user.id,
    { isReturning: false },
    { new: true }
  );

  return res.json({ message: "Welcome back! You are now available for new orders.", user: updatedUser });
});
