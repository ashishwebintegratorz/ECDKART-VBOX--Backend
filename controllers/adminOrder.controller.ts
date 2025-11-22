import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import OrderModel from "../models/Order.model.js";
import { emitOrderStatusUpdate } from "../socket/orderSocket.js";
import { NotFoundException } from "../utils/appError.js";

export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { status } = req.body;
    const order = await OrderModel.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");
    order.status = status;
    await order.save();

    emitOrderStatusUpdate(orderId, {
      status: order.status,
      updatedAt: (order as any).updatedAt,
    });
    return res.json({ message: "Status updated", order });
  }
);
