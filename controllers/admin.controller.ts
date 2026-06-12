import { Request, Response } from "express";
import Order from "../models/Order.model.js";
import UserModel from "../models/User.model.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";

export const getDashboardMetrics = asyncHandler(async (req: Request, res: Response) => {
  // 1. Total Customers
  const totalCustomers = await UserModel.countDocuments({ role: "user" });

  // 2. Total Orders
  const totalOrders = await Order.countDocuments();

  // 3. Total Revenue & Monthly Sales
  // We'll aggregate completed/delivered orders
  const orders = await Order.find();

  let totalRevenue = 0;
  const currentYear = new Date().getFullYear();
  
  // Array of 12 months, initialized to 0
  const monthlySales = Array(12).fill(0);
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
  const currentMonthSales = monthlySales[new Date().getMonth()];
  const previousMonthSales = new Date().getMonth() > 0 ? monthlySales[new Date().getMonth() - 1] : 0;
  
  const revenueGrowth = previousMonthSales > 0 
    ? ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100 
    : 100; // 100% growth if no previous month

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
    monthlySales,
    ordersByArea,
    recentOrders,
  });
});
