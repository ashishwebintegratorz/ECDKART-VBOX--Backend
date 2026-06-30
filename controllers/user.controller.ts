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
  
  return res.json({ message: user.isBlocked ? "User blocked successfully" : "User unblocked successfully", user });
});

export const getUserNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const Notification = (await import("../models/Notification.model.js")).default;
  
  const targetGroupChecks: any[] = [{ targetGroup: 'ALL_USERS' }];
  
  if (user.role === 'driver') {
    targetGroupChecks.push({ targetGroup: 'ALL_DRIVERS' });
    targetGroupChecks.push({ targetGroup: 'SPECIFIC_DRIVERS', targetUsers: user._id });
  } else {
    targetGroupChecks.push({ targetGroup: 'SPECIFIC_USERS', targetUsers: user._id });
  }
  
  targetGroupChecks.push({ targetGroup: 'SPECIFIC', targetUsers: user._id });
  
  const notifications = await Notification.find({
    $or: targetGroupChecks
  }).sort({ createdAt: -1 }).limit(50);
  
  const mappedNotifications = notifications.map(n => {
    const obj = n.toObject();
    return {
      ...obj,
      read: n.readBy && n.readBy.includes(user._id)
    };
  });
  
  res.status(200).json(mappedNotifications);
});

export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const Notification = (await import("../models/Notification.model.js")).default;
  
  await Notification.findByIdAndUpdate(id, {
    $addToSet: { readBy: user._id }
  });
  
  res.status(200).json({ success: true });
});
