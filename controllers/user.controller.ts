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

// Get all users for admin management (with order stats)
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await UserModel.find().sort({ createdAt: -1 });
  
  // Aggregate order stats per user
  const stats = await OrderModel.aggregate([
    {
      $group: {
        _id: "$customer",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$payableAmount" },
      }
    }
  ]);

  const statsMap = stats.reduce((acc, curr) => {
    acc[curr._id.toString()] = { totalOrders: curr.totalOrders, totalSpent: curr.totalSpent };
    return acc;
  }, {} as any);

  const enrichedUsers = users.map(user => {
    const stat = statsMap[user._id.toString()] || { totalOrders: 0, totalSpent: 0 };
    return {
      ...user.toObject(),
      totalOrders: stat.totalOrders,
      totalSpent: stat.totalSpent,
    };
  });

  return res.json(enrichedUsers);
});

// Toggle block status for a user (Admin only)
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await UserModel.findById(id);
  
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.isBlocked = !user.isBlocked;
  await user.save();

  return res.json({ success: true, isBlocked: user.isBlocked, user });
});
