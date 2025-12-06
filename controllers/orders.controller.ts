import { Request, Response } from "express";
import Order from "../models/Order.model.js";
import Assignment from "../models/Assignment.model.js";
import PaymentTransaction from "../models/PaymentTransaction.model.js";
import Address from "../models/Address.model.js";
import User from "../models/User.model.js";

import {
  BadRequestException,
  NotFoundException,
  InternalServerException,
} from "../utils/appError.js";

// ---------------------------------------------
// 1️⃣ Create Order
// ---------------------------------------------
export const createOrder = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { items, addressId, totalAmount, payableAmount, meta } = req.body;

  if (!items || items.length === 0)
    throw new BadRequestException("Order must contain items");

  if (!addressId)
    throw new BadRequestException("Address ID is required");

  const address = await Address.findById(addressId);
  if (!address) throw new NotFoundException("Address not found");

  // unique readable order number
  const lastOrder = await Order.findOne().sort({ createdAt: -1 });
  const orderNumber = "ORD-" + ((lastOrder?._id.toString().slice(-6)) || "100001");

  const order = await Order.create({
    orderNumber,
    customer: userId,
    items,
    totalAmount,
    payableAmount,
    address: {
      _id: address._id,
      fullAddress: address.fullAddress,
      coordinates: address.location.coordinates,
      phone: address.phone,
      label: address.label,
    },
    meta,
  });

  return res.status(201).json({
    message: "Order created successfully",
    order,
  });
};

// ---------------------------------------------
// 2️⃣ Get All Orders (Admin + Filters)
// ---------------------------------------------
export const getAllOrders = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const status = req.query.status as string;

  const filter: any = {};
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name phone")
      .populate("assignedDriver", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Order.countDocuments(filter),
  ]);

  return res.json({
    orders,
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  });
};

// ---------------------------------------------
// 3️⃣ Get Single Order
// ---------------------------------------------
export const getOrderById = async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id)
    .populate("customer", "name phone")
    .populate("assignedDriver", "name phone");

  if (!order) throw new NotFoundException("Order not found");

  return res.json({ order });
};

// ---------------------------------------------
// 4️⃣ Get My Orders (Customer)
// ---------------------------------------------
export const getMyOrders = async (req: Request, res: Response) => {
  const orders = await Order.find({ customer: req.user.id })
    .sort({ createdAt: -1 });

  return res.json({ orders });
};

// ---------------------------------------------
// 5️⃣ Get Driver Orders
// ---------------------------------------------
export const getDriverOrders = async (req: Request, res: Response) => {
  const orders = await Order.find({ assignedDriver: req.user.id })
    .sort({ createdAt: -1 });

  return res.json({ orders });
};

// ---------------------------------------------
// 6️⃣ Update Order Status
// ---------------------------------------------
export const updateOrderStatus = async (req: Request, res: Response) => {
  const { status } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundException("Order not found");

  order.status = status;
  await order.save();

  return res.json({
    message: "Order status updated",
    order,
  });
};

// ---------------------------------------------
// 7️⃣ Assign Driver
// ---------------------------------------------
export const assignDriver = async (req: Request, res: Response) => {
  const { orderId, driverId } = req.body;

  const driver = await User.findById(driverId);
  if (!driver || driver.role !== "driver")
    throw new BadRequestException("Invalid driver ID");

  const assignment = await Assignment.create({
    driver: driverId,
    orders: [orderId],
  });

  const order = await Order.findByIdAndUpdate(
    orderId,
    {
      assignedDriver: driverId,
      assignmentId: assignment._id,
      status: "out_for_delivery",
    },
    { new: true }
  );

  if (!order) throw new InternalServerException("Driver assignment failed");

  return res.json({
    message: "Driver assigned",
    order,
  });
};

// ---------------------------------------------
// 8️⃣ Cancel Order
// ---------------------------------------------
export const cancelOrder = async (req: Request, res: Response) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  );

  if (!order) throw new NotFoundException("Order not found");

  return res.json({ 
    message: "Order cancelled",
    order,
  });
};
