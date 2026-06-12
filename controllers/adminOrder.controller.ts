import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import OrderModel from "../models/Order.model.js";
import { emitOrderStatusUpdate } from "../socket/orderSocket.js";
import { NotFoundException } from "../utils/appError.js";

export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { status, deliveryStatus } = req.body;
    const order = await OrderModel.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");

    if (status) order.status = status;
    if (deliveryStatus) order.deliveryStatus = deliveryStatus;

    await order.save();

    emitOrderStatusUpdate(orderId as string, {
      status: order.status,
      deliveryStatus: order.deliveryStatus,
      updatedAt: (order as any).updatedAt,
    });
    return res.json({ message: "Status updated", order });
  }
);

export const assignDriverToOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { driverId } = req.body;

    const order = await OrderModel.findById(orderId).populate("customer", "name phone");
    if (!order) throw new NotFoundException("Order not found");

    if (order.status !== "confirmed" && order.status !== "pending") {
      return res.status(400).json({ message: "Order cannot be assigned in current status" });
    }

    order.assignedDriver = driverId;
    order.assignmentStatus = "assigned";
    order.deliveryStatus = "assigned";
    await order.save();

    // Emit order to specific driver
    const { emitOrderToDriver } = require("../socket/orderSocket.js");
    emitOrderToDriver(driverId, order);

    return res.json({ message: "Driver assigned successfully", order });
  }
);
