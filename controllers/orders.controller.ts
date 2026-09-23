// controllers/order.controller.ts
import Order from "../models/Order.model.js";
import Cart from "../models/Cart.model.js";
import PaymentTransaction from "../models/PaymentTransaction.model.js";
import Invoice from "../models/Invoice.model.js";
import { razorpay } from "../config/razorpay.config.js";
import crypto from "crypto";
import { Request, Response } from "express";
import { confirmOrderLogic } from "../services/order.service.js";
import User from "../models/User.model.js";
import { emitOrderStatusUpdate, emitAdminNotification } from "../socket/orderSocket.js";
import Address from "../models/Address.model.js";
import { calculateDeliveryCharge, isWithinIndore } from "../utils/delivery.utils.js";
import Coupon from "../models/Coupon.model.js";

export const createOrder = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { addressId, deliveryAddress, paymentMethod, scheduleDate, timeSlot, items, totalAmount: reqTotalAmount, couponCode } = req.body;

  let addressSnapshot: any = {
    fullAddress: deliveryAddress || "123 Main Street, Indore",
    city: "Indore",
    state: "MP",
    zipCode: "452001",
    location: {
      type: "Point",
      coordinates: [75.8577, 22.7196] // Indore coordinates
    }
  };

  if (addressId) {
    // 1️⃣ Fetch & validate address if addressId is provided
    const addressDoc = await Address.findOne({
      _id: addressId,
      user: userId,
    });

    if (addressDoc) {
      // ✅ Geo Location Check
      const { location } = addressDoc;
      if (location && location.coordinates && location.coordinates.length >= 2) {
        const [lng, lat] = location.coordinates;
        if (!(await isWithinIndore(lat, lng))) {
          return res.status(400).json({
            message: "Delivery is only available in Indore"
          });
        }
      }

      addressSnapshot = {
        fullAddress: addressDoc.fullAddress,
        apartment: addressDoc.apartment,
        landmark: addressDoc.landmark,
        location: addressDoc.location,
        phone: addressDoc.phone,
      };
    }
  } else if (!deliveryAddress) {
     return res.status(400).json({ message: "Delivery address is required" });
  }

  // 2️⃣ Get cart
  let cartItems = [];
  let totalAmount = 0;

  const cart = await Cart.findOne({ user: userId });
  if (cart && cart.items.length > 0) {
    cartItems = cart.items;
    totalAmount = cartItems.reduce((s: any, i: any) => s + i.priceAtAdd * i.qty, 0);
  } else if (items && items.length > 0) {
    cartItems = items;
    totalAmount = reqTotalAmount || cartItems.reduce((s: any, i: any) => s + i.priceAtAdd * i.qty, 0);
  } else {
    return res.status(400).json({ message: "Cart empty" });
  }

  // ✅ Min order check (Disabled for demo)
  // if (totalAmount < 100) {
  //   return res.status(400).json({
  //     message: "Minimum order amount is ₹100"
  //   });
  // }

  // ✅ Delivery charge
  const deliveryCharge = calculateDeliveryCharge(totalAmount);
  let payableAmount = totalAmount + deliveryCharge;
  let discountAmount = 0;

  // ✅ Coupon logic
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), active: true });
    if (coupon) {
      if (coupon.validFrom && new Date() < coupon.validFrom) {
        return res.status(400).json({ message: "Coupon is not valid yet." });
      }
      if (coupon.validTo && new Date() > coupon.validTo) {
        return res.status(400).json({ message: "Coupon has expired." });
      }
      if (coupon.usedBy && coupon.usedBy.some(id => id.toString() === userId)) {
        return res.status(400).json({ message: "You have already used this coupon." });
      }
      if (coupon.minOrderValue && totalAmount < coupon.minOrderValue) {
        return res.status(400).json({ message: `Minimum order value for this coupon is ₹${coupon.minOrderValue}` });
      }

      let applicableAmount = totalAmount;
      // If coupon is restricted to specific products
      if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
        applicableAmount = cartItems.reduce((sum: number, item: any) => {
          if (coupon.applicableProducts?.some(p => p.toString() === item.product.toString())) {
            return sum + (item.priceAtAdd * item.qty);
          }
          return sum;
        }, 0);
      }

      if (applicableAmount > 0) {
        if (coupon.discountType === "percent") {
          discountAmount = (applicableAmount * coupon.discountValue) / 100;
          if (coupon.maxDiscountValue && discountAmount > coupon.maxDiscountValue) {
            discountAmount = coupon.maxDiscountValue;
          }
        } else {
          discountAmount = coupon.discountValue;
        }

        payableAmount = Math.max(0, payableAmount - discountAmount);

        // Mark coupon as used
        coupon.usedBy?.push(userId as any);
        await coupon.save();
      } else {
        return res.status(400).json({ message: "Coupon is not applicable to any items in your cart." });
      }
    } else {
      return res.status(400).json({ message: "Invalid or inactive coupon code." });
    }
  }

  // 5️⃣ Create order
  const order = await Order.create({
    orderNumber: `ORD-${Date.now()}`,
    customer: userId,
    items: cartItems.map((i: any) => ({
      product: i.product,
      name: i.name,
      image: i.image,
      unit: i.unit,
      variantIndex: i.variantIndex,
      qty: i.qty,
      price: i.priceAtAdd,
      subtotal: i.priceAtAdd * i.qty,
    })),
    totalAmount,
    deliveryCharge,
    payableAmount,
    discountAmount,
    couponCode: couponCode ? couponCode.toUpperCase() : undefined,
    address: addressSnapshot,
    status: "pending",
    deliveryStatus: "pending",
    scheduleDate,
    timeSlot,
    assignmentStatus: "pending",
    paymentMethod,
    codSettledWithAdmin: false,
  });

  // 6️⃣ COD flow
  if (paymentMethod === "cod") {
    await PaymentTransaction.create({
      order: order._id,
      provider: "cod",
      amount: payableAmount,
      status: "success",
    });

    await confirmOrderLogic(order._id.toString());
    const updatedOrder = await Order.findById(order._id);
    return res.json({ order: updatedOrder, cod: true });
  }

  // 7️⃣ Razorpay flow
  const razorpayOrder = await razorpay.orders.create({
    amount: payableAmount * 100,
    currency: "INR",
    receipt: order.orderNumber,
    payment_capture: true,
  });

  await PaymentTransaction.create({
    order: order._id,
    provider: "razorpay",
    providerPaymentId: razorpayOrder.id,
    amount: payableAmount,
    status: "initiated",
  });

  res.json({
    orderId: order._id,
    razorpayOrderId: razorpayOrder.id,
    amount: payableAmount,
    deliveryCharge,
    currency: "INR",
  });
};

export const verifyPayment = async (req: Request, res: Response) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature)
    return res.status(400).json({ message: "Invalid payment signature" });

  const transaction = await PaymentTransaction.findOne({
    providerPaymentId: razorpay_order_id,
  });

  if (!transaction)
    return res.status(404).json({ message: "Transaction not found" });

  transaction.status = "success";
  transaction.meta = { razorpay_payment_id };
  await transaction.save();

  await confirmOrderLogic(transaction.order.toString());

  res.json({ success: true });
};

export const getMyOrders = async (req: Request, res: Response) => {
  const userId = req.user.id;

  const orders = await Order.find({ customer: userId })
    .sort({ createdAt: -1 })
    .populate("paymentTransaction");

  res.json(orders);
};

export const getOrderById = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const user = (req as any).user;

  const order = await Order.findById(orderId)
    .populate("customer", "name email phone avatar")
    .populate("assignedDriver", "name phone avatar")
    .populate("items.product", "name variants images")
    .populate("paymentTransaction");

  if (!order)
    return res.status(404).json({ message: "Order not found" });

  const isAdmin = user.role === "admin";
  const isOwner = order.customer._id.toString() === user.id;
  const isAssignedDriver = order.assignedDriver?.toString() === user.id;

  if (!isAdmin && !isOwner && !isAssignedDriver) {
    return res.status(403).json({ message: "You do not have permission to access this order" });
  }

  res.json(order);
};

export const cancelOrder = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  const order = await Order.findOne({ _id: orderId, customer: userId });

  if (!order)
    return res.status(404).json({ message: "Order not found" });

  if (!["pending", "confirmed"].includes(order.status))
    return res.status(400).json({ message: "Order cannot be cancelled now" });

  order.status = "cancelled";
  await order.save();

  // Handle refunds for non-COD successful payments
  if (order.paymentMethod !== "cod") {
    const successTransaction = await PaymentTransaction.findOne({
      order: order._id,
      status: "success"
    });

    if (successTransaction) {
      // Import dynamically to avoid circular dependencies if any
      const { default: Refund } = await import("../models/Refund.model.js");
      await Refund.create({
        order: order._id,
        customer: userId,
        amount: successTransaction.amount,
        status: "pending"
      });
      // We do not mark the transaction as failed, because the payment was successful.
      // The refund record handles the reverse flow.
    } else {
      await PaymentTransaction.updateMany(
        { order: order._id, status: { $ne: "success" } },
        { status: "failed" }
      );
    }
  } else {
    // For COD, just mark transactions as failed
    await PaymentTransaction.updateMany(
      { order: order._id },
      { status: "failed" }
    );
  }

  res.json({ success: true, order });
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { status, deliveryStatus } = req.body;

  const allowedStatus = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "failed",
  ];

  if (status && !allowedStatus.includes(status))
    return res.status(400).json({ message: "Invalid status" });

  const updatePayload: any = {};
  if (status) updatePayload.status = status;
  if (deliveryStatus) updatePayload.deliveryStatus = deliveryStatus;

  const order = await Order.findByIdAndUpdate(
    orderId,
    updatePayload,
    { new: true }
  );

  if (!order)
    return res.status(404).json({ message: "Order not found" });

  res.json(order);
};

export const getAllOrders = async (req: Request, res: Response) => {
  const { status, deliveryStatus, from, to } = req.query;

  const query: any = {};

  if (status) query.status = status;
  if (deliveryStatus) query.deliveryStatus = deliveryStatus;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from as string);
    if (to) query.createdAt.$lte = new Date(to as string);
  }

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .populate("customer", "name email phone avatar")
    .populate("assignedDriver", "name phone");

  res.json(orders);
};

export const assignOrderToDriver = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { driverId } = req.body;

  if (!driverId)
    return res.status(400).json({ message: "Driver ID is required" });

  const driver = await User.findOne({ _id: driverId, role: "driver" });
  if (!driver)
    return res.status(404).json({ message: "Driver not found" });

  if (!driver.isOnline)
    return res.status(400).json({ message: "Driver is currently offline" });

  const activeOrder = await Order.findOne({
    assignedDriver: driverId,
    deliveryStatus: { $in: ["assigned", "out_for_delivery"] }
  });

  if (activeOrder)
    return res.status(400).json({ message: "Driver is already busy with another delivery" });

  const order = await Order.findById(orderId);
  if (!order)
    return res.status(404).json({ message: "Order not found" });

  order.assignedDriver = driverId as any;
  order.deliveryStatus = "assigned";
  order.assignmentStatus = "assigned";
  driver.isReturning = true;
  await order.save();
  await driver.save();

  const { emitOrderToDriver, emitOrderStatusUpdate } = await import("../socket/orderSocket.js");
  
  // Re-fetch populated order to send to driver
  const populatedOrder = await Order.findById(orderId).populate("customer", "name phone").exec();
  emitOrderToDriver(driverId as string, populatedOrder);
  
  // Notify user that order was assigned
  emitOrderStatusUpdate(orderId as string, { 
    status: order.status, 
    deliveryStatus: order.deliveryStatus,
    driver: driver.name,
    driverPhone: driver.phone
  });

  res.json({ message: "Order assigned to driver", order });
};

export const getDriverOrders = async (req: Request, res: Response) => {
  const driverId = req.user.id;
  const { status, deliveryStatus } = req.query;

  const query: any = { assignedDriver: driverId };
  if (status) query.status = status;
  if (deliveryStatus) query.deliveryStatus = deliveryStatus;

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .populate("customer", "name phone");

  res.json(orders);
};

export const getActiveDriverOrders = async (req: Request, res: Response) => {
  const driverId = req.user.id;
  const orders = await Order.find({ 
    assignedDriver: driverId, 
    deliveryStatus: { $in: ["assigned", "out_for_delivery"] } 
  })
  .sort({ createdAt: -1 })
  .populate("customer", "name phone");
  
  res.json(orders);
};

export const getDriverOrderHistory = async (req: Request, res: Response) => {
  const driverId = req.user.id;
  const orders = await Order.find({ 
    assignedDriver: driverId, 
    deliveryStatus: "delivered" 
  })
  .sort({ createdAt: -1 })
  .populate("customer", "name phone");
  
  res.json(orders);
};

export const updateOrderByDriver = async (req: Request, res: Response) => {
  const driverId = req.user.id;
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const { status } = req.body;

  const allowedStatuses = ["out_for_delivery", "delivered", "failed"];
  if (!allowedStatuses.includes(status))
    return res.status(400).json({ message: "Invalid status for driver" });

  const order = await Order.findOne({ _id: orderId, assignedDriver: driverId });
  if (!order)
    return res.status(404).json({ message: "Order not found or not assigned to you" });

  order.deliveryStatus = status as any;
  await order.save();

  if (status === "delivered") {
    // Notify admin
    emitAdminNotification("ORDER_DELIVERED", `Order Delivered: ${order.orderNumber}`, order);

    const remainingOrders = await Order.findOne({
      assignedDriver: driverId,
      deliveryStatus: { $in: ["assigned", "out_for_delivery"] },
      _id: { $ne: orderId }
    });

    if (!remainingOrders) {
      await User.findByIdAndUpdate(driverId, { isReturning: true });
    }
  }

  emitOrderStatusUpdate(orderId as string, {
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    updatedAt: (order as any).updatedAt,
  });

  res.json({ message: `Order status updated to ${status}`, order });
};

export const acceptOrderBroadcast = async (req: Request, res: Response) => {
  const driverId = (req as any).user._id.toString();
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  console.log("acceptOrderBroadcast CALLED:");
  console.log("driverId:", driverId);
  console.log("order.assignedDriver:", order.assignedDriver);
  console.log("order.assignmentStatus:", order.assignmentStatus);

  if (order.assignedDriver && order.assignedDriver.toString() === driverId) {
    return res.status(200).json({ success: true, message: "Order accepted successfully", order });
  }

  if (order.assignmentStatus === "assigned" || order.assignedDriver) {
    return res.status(400).json({ message: "Order has already been assigned to another driver" });
  }

  const driver = await User.findById(driverId);
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  order.assignedDriver = driverId as any;
  order.assignmentStatus = "assigned";
  order.deliveryStatus = "assigned";
  await order.save();

  // Notify admin & user
  emitOrderStatusUpdate(orderId as string, {
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    assignmentStatus: order.assignmentStatus,
    updatedAt: (order as any).updatedAt,
  });

  res.json({ message: "Order accepted successfully", order });
};

export const declineOrderBroadcast = async (req: Request, res: Response) => {
  const driverId = req.user.id;
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (!order.rejectedBy) order.rejectedBy = [];
  if (!order.rejectedBy.includes(driverId as any)) {
    order.rejectedBy.push(driverId as any);
    await order.save();
  }

  res.json({ message: "Order declined" });
};

export const rescheduleOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { timeSlot, scheduleDate } = req.body;

  if (!timeSlot || !scheduleDate) {
    return res.status(400).json({ message: "Time slot and Schedule Date are required" });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const oldTimeSlot = order.timeSlot;
  const oldScheduleDate = order.scheduleDate;
  
  order.timeSlot = timeSlot;
  order.scheduleDate = scheduleDate;
  await order.save();

  emitOrderStatusUpdate(orderId as string, {
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    timeSlot: order.timeSlot,
    scheduleDate: order.scheduleDate,
    updatedAt: (order as any).updatedAt,
    notificationMessage: `Some issue to we have to reschedule your order. Sorry for inconvenient to rescheduling your order. New Date: ${scheduleDate}, New Time: ${timeSlot}`
  });

  res.json({ message: "Order rescheduled successfully", order, oldTimeSlot, oldScheduleDate });
};

export const verifyCoupon = async (req: Request, res: Response) => {
  try {
    const { code, items } = req.body;
    const userId = req.user.id;

    if (!code || !items || !items.length) {
      return res.status(400).json({ message: "Coupon code and cart items are required." });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });
    
    if (!coupon) {
      return res.status(404).json({ message: "Invalid or inactive coupon code." });
    }

    if (coupon.validFrom && new Date() < coupon.validFrom) {
      return res.status(400).json({ message: "Coupon is not valid yet." });
    }
    if (coupon.validTo && new Date() > coupon.validTo) {
      return res.status(400).json({ message: "Coupon has expired." });
    }
    if (coupon.usedBy && coupon.usedBy.includes(userId as any)) {
      return res.status(400).json({ message: "You have already used this coupon." });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + ((item.priceAtAdd || item.price) * item.qty), 0);

    if (coupon.minOrderValue && totalAmount < coupon.minOrderValue) {
      return res.status(400).json({ message: `Minimum order value for this coupon is ₹${coupon.minOrderValue}` });
    }

    let applicableAmount = totalAmount;
    if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
      applicableAmount = items.reduce((sum: number, item: any) => {
        if (coupon.applicableProducts?.some(p => p.toString() === item.product.toString())) {
          return sum + ((item.priceAtAdd || item.price) * item.qty);
        }
        return sum;
      }, 0);
    }

    if (applicableAmount <= 0) {
      return res.status(400).json({ message: "Coupon is not applicable to any items in your cart." });
    }

    let discountAmount = 0;
    if (coupon.discountType === "percent") {
      discountAmount = (applicableAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountValue && discountAmount > coupon.maxDiscountValue) {
        discountAmount = coupon.maxDiscountValue;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    return res.json({
      valid: true,
      code: coupon.code,
      discountAmount: discountAmount,
      message: "Coupon applied successfully!"
    });
  } catch (error) {
    console.error("Error verifying coupon:", error);
    return res.status(500).json({ message: "Failed to verify coupon." });
  }
};