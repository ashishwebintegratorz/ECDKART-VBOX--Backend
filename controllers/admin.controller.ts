import { Request, Response } from "express";
import Order from "../models/Order.model.js";
import UserModel from "../models/User.model.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import cloudinary from "../config/cloudinary.js";

// Cloudinary Upload Helper
const uploadToCloudinary = (file: Express.Multer.File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "notifications" },
      (err, result) => {
        if (err || !result) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
};

const deleteFromCloudinary = async (imageUrl: string) => {
  try {
    if (!imageUrl) return;
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const publicId = "notifications/" + filename.split('.')[0];
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

export const getDashboardMetrics = asyncHandler(async (req: Request, res: Response) => {
  // 1. Total Customers
  const totalCustomers = await UserModel.countDocuments({ role: "customer" });

  // 2. Total Orders
  const totalOrders = await Order.countDocuments();

  // 3. Total Revenue & Monthly Sales
  // We'll aggregate completed/delivered orders
  const orders = await Order.find();

  let totalRevenue = 0;
  const currentYear = new Date().getFullYear();
  
  // Array of 12 months, initialized to 0
  const monthlySales = Array(12).fill(0);
  const monthlyOrders = Array(12).fill(0);
  const ordersByArea: Record<string, number> = {};

  orders.forEach((order: any) => {
    // Only count delivered orders for revenue (or all valid orders based on business logic)
    // Here we'll count all that are not cancelled
    if (order.status !== "cancelled") {
      totalRevenue += order.payableAmount || 0;

      // Group by month
      const orderDate = new Date(order.createdAt);
      if (orderDate.getFullYear() === currentYear) {
        monthlySales[orderDate.getMonth()] += order.payableAmount || 0;
        monthlyOrders[orderDate.getMonth()] += 1;
      }

      // Group by Area
      if (order.address && order.address.city) {
        const area = order.address.city.trim();
        ordersByArea[area] = (ordersByArea[area] || 0) + 1;
      }
    }
  });

  // Calculate percentage increases (mock logic based on simple division for now, ideally compare against last month)
  // Let's pretend previous month was some value to show growth
  const currentMonth = new Date().getMonth();
  const currentMonthSales = monthlySales[currentMonth];
  const previousMonthSales = currentMonth > 0 ? monthlySales[currentMonth - 1] : 0;
  
  const revenueGrowth = previousMonthSales > 0 
    ? ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100 
    : (currentMonthSales > 0 ? 100 : 0);

  const currentMonthOrdersCount = monthlyOrders[currentMonth];
  const previousMonthOrdersCount = currentMonth > 0 ? monthlyOrders[currentMonth - 1] : 0;
  const orderGrowth = previousMonthOrdersCount > 0
    ? ((currentMonthOrdersCount - previousMonthOrdersCount) / previousMonthOrdersCount) * 100
    : (currentMonthOrdersCount > 0 ? 100 : 0);

  // Mocking customer growth for now (since we don't have created date grouped here)
  const customerGrowth = totalCustomers > 0 ? 11.01 : 0;

  // Recent Orders
  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("customer", "name avatar")
    .populate("items.product", "name images variants")
    .lean();

  res.json({
    totalCustomers,
    totalOrders,
    totalRevenue,
    revenueGrowth: revenueGrowth.toFixed(2),
    orderGrowth: orderGrowth.toFixed(2),
    customerGrowth: customerGrowth.toFixed(2),
    monthlySales,
    monthlyOrders,
    ordersByArea,
    recentOrders,
  });
});

export const getUsersList = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.query; // 'user' or 'driver'
  const filter: any = {};
  if (type === 'user') filter.role = 'customer';
  if (type === 'driver') filter.role = 'driver';
  
  const foreignField = type === 'driver' ? 'assignedDriver' : 'customer';

  const users = await UserModel.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: foreignField,
        as: "orders"
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        phone: 1,
        email: 1,
        role: 1,
        totalOrders: { $size: "$orders" },
        cancelledOrders: {
          $size: {
            $filter: {
              input: "$orders",
              as: "order",
              cond: { $eq: ["$$order.status", "cancelled"] }
            }
          }
        },
        totalSpent: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$orders",
                  as: "order",
                  cond: { $ne: ["$$order.status", "cancelled"] }
                }
              },
              as: "validOrder",
              in: "$$validOrder.payableAmount"
            }
          }
        },
        refundAmount: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$orders",
                  as: "order",
                  cond: { 
                    $and: [
                      { $eq: ["$$order.status", "cancelled"] },
                      { $eq: ["$$order.paymentStatus", "paid"] }
                    ]
                  }
                }
              },
              as: "refundOrder",
              in: "$$refundOrder.payableAmount"
            }
          }
        },
        // For Drivers
        totalDelivery: {
          $size: {
            $filter: {
              input: "$orders",
              as: "order",
              cond: { $eq: ["$$order.deliveryStatus", "delivered"] }
            }
          }
        },
        cancelledDelivery: {
          $size: {
            $filter: {
              input: "$orders",
              as: "order",
              cond: { $eq: ["$$order.deliveryStatus", "cancelled"] }
            }
          }
        },
        totalReceived: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$orders",
                  as: "order",
                  cond: { $eq: ["$$order.deliveryStatus", "delivered"] }
                }
              },
              as: "deliveredOrder",
              in: "$$deliveredOrder.payableAmount"
            }
          }
        }
      }
    }
  ]);
  
  res.json(users);
});

export const broadcastNotification = asyncHandler(async (req: Request, res: Response) => {
  let { title, message, targetGroup, targetUsers, image } = req.body;
  
  // Parse targetUsers if it is sent as stringified JSON from FormData
  if (typeof targetUsers === 'string') {
    try { targetUsers = JSON.parse(targetUsers); } catch(e) {}
  }
  
  if (req.file) {
    image = await uploadToCloudinary(req.file);
  }
  
  // Create the notification record
  const Notification = (await import("../models/Notification.model.js")).default;
  
  const newNotif = new Notification({
    title,
    body: message,
    image,
    targetGroup,
    targetUsers: Array.isArray(targetUsers) ? targetUsers : [],
    type: 'broadcast'
  });
  
  await newNotif.save();
  
  // Get io instance to emit to connected clients
  const { getIo } = await import("../socket/orderSocket.js");
  const io = getIo();
  
  if (targetGroup === 'ALL_USERS' || targetGroup === 'ALL_DRIVERS') {
    io.emit('new_broadcast_notification', newNotif); // Global emit
  } else if ((targetGroup === 'SPECIFIC' || targetGroup === 'SPECIFIC_USERS' || targetGroup === 'SPECIFIC_DRIVERS') && targetUsers && targetUsers.length > 0) {
    targetUsers.forEach((userId: string) => {
      io.to(`user_${userId}`).emit('new_notification', newNotif);
    });
  }
  
  res.status(201).json({ message: "Notification broadcasted successfully", notification: newNotif });
});

export const broadcastCoupon = asyncHandler(async (req: Request, res: Response) => {
  let { code, discountType, discountValue, description, title, message, targetGroup, targetUsers, applicableProducts, image } = req.body;
  
  if (typeof targetUsers === 'string') {
    try { targetUsers = JSON.parse(targetUsers); } catch(e) {}
  }
  if (typeof applicableProducts === 'string') {
    try { applicableProducts = JSON.parse(applicableProducts); } catch(e) {}
  }
  
  if (req.file) {
    image = await uploadToCloudinary(req.file);
  }
  
  const Coupon = (await import("../models/Coupon.model.js")).default;
  const Notification = (await import("../models/Notification.model.js")).default;
  
  // Create Coupon
  const newCoupon = new Coupon({
    code,
    discountType,
    discountValue: Number(discountValue),
    description,
    title,
    message,
    image,
    applicableProducts: Array.isArray(applicableProducts) ? applicableProducts : []
  });
  await newCoupon.save();
  
  // Create corresponding notification
  const newNotif = new Notification({
    title: title || `New Coupon: ${code}`,
    body: message || description || `Use code ${code} to get a discount!`,
    image,
    targetGroup,
    targetUsers,
    type: 'coupon',
    data: { couponId: newCoupon._id, code }
  });
  await newNotif.save();
  
  // Emit via Socket
  const { getIo } = await import("../socket/orderSocket.js");
  const io = getIo();
  
  if (targetGroup === 'ALL_USERS' || targetGroup === 'ALL_DRIVERS') {
    io.emit('new_broadcast_notification', newNotif);
  } else if ((targetGroup === 'SPECIFIC' || targetGroup === 'SPECIFIC_USERS' || targetGroup === 'SPECIFIC_DRIVERS') && targetUsers && targetUsers.length > 0) {
    targetUsers.forEach((userId: string) => {
      io.to(`user_${userId}`).emit('new_notification', newNotif);
    });
  }
  
  res.status(201).json({ message: "Coupon created and broadcasted successfully", coupon: newCoupon });
});

export const getAllCoupons = asyncHandler(async (req: Request, res: Response) => {
  const Coupon = (await import("../models/Coupon.model.js")).default;
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.status(200).json(coupons);
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (req.file) {
    updates.image = await uploadToCloudinary(req.file);
  }
  
  // Parse stringified arrays if provided
  if (typeof updates.applicableProducts === 'string') {
    try { updates.applicableProducts = JSON.parse(updates.applicableProducts); } catch(e) {}
  }
  if (typeof updates.targetUsers === 'string') {
    try { updates.targetUsers = JSON.parse(updates.targetUsers); } catch(e) {}
  }
  
  const Coupon = (await import("../models/Coupon.model.js")).default;
  const oldCoupon = await Coupon.findById(id);
  
  if (!oldCoupon) {
    res.status(404).json({ message: "Coupon not found" });
    return;
  }
  
  // Delete old image if a new one is uploaded and old one exists
  if (req.file && oldCoupon.image) {
    await deleteFromCloudinary(oldCoupon.image);
  }

  const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
  res.status(200).json({ message: "Coupon updated successfully", coupon: updatedCoupon });
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const Coupon = (await import("../models/Coupon.model.js")).default;
  const deletedCoupon = await Coupon.findByIdAndDelete(id);
  if (!deletedCoupon) {
    res.status(404).json({ message: "Coupon not found" });
    return;
  }
  
  if (deletedCoupon.image) {
    await deleteFromCloudinary(deletedCoupon.image);
  }
  
  res.status(200).json({ message: "Coupon deleted successfully" });
});

export const getAllNotifications = asyncHandler(async (req: Request, res: Response) => {
  const Notification = (await import("../models/Notification.model.js")).default;
  const notifications = await Notification.find({ type: 'broadcast' }).sort({ createdAt: -1 });
  res.status(200).json(notifications);
});

export const updateNotification = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (req.file) {
    updates.image = await uploadToCloudinary(req.file);
  }
  
  if (typeof updates.targetUsers === 'string') {
    try { updates.targetUsers = JSON.parse(updates.targetUsers); } catch(e) {}
  }
  
  if (updates.message) {
    updates.body = updates.message;
    delete updates.message;
  }

  const Notification = (await import("../models/Notification.model.js")).default;
  const oldNotif = await Notification.findById(id);
  
  if (!oldNotif) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }
  
  if (req.file && oldNotif.image) {
    await deleteFromCloudinary(oldNotif.image);
  }

  const updatedNotif = await Notification.findByIdAndUpdate(id, updates, { new: true });
  res.status(200).json({ message: "Notification updated successfully", notification: updatedNotif });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const Notification = (await import("../models/Notification.model.js")).default;
  const deletedNotif = await Notification.findByIdAndDelete(id);
  if (!deletedNotif) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }
  
  if (deletedNotif.image) {
    await deleteFromCloudinary(deletedNotif.image);
  }
  
  res.status(200).json({ message: "Notification deleted successfully" });
});


