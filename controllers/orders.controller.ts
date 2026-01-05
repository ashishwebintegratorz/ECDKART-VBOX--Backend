// controllers/order.controller.ts
import Order from "../models/Order.model.js";
import Cart from "../models/Cart.model.js";
import PaymentTransaction from "../models/PaymentTransaction.model.js";
import Invoice from "../models/Invoice.model.js";
import { razorpay } from "../config/razorpay.config.js";
import crypto from "crypto";
import { Request, Response } from "express";
import { confirmOrderLogic } from "../services/order.service.js";

import Address from "../models/Address.model.js";

export const createOrder = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { addressId, paymentMethod } = req.body;

  if (!addressId)
    return res.status(400).json({ message: "Address is required" });

  // 1️⃣ Fetch & validate address
  const addressDoc = await Address.findOne({
    _id: addressId,
    user: userId,
  });

  if (!addressDoc)
    return res.status(404).json({ message: "Address not found" });

  // 2️⃣ Get cart
  const cart = await Cart.findOne({ user: userId });
  if (!cart || cart.items.length === 0)
    return res.status(400).json({ message: "Cart empty" });

  // 3️⃣ Snapshot address
  const addressSnapshot = {
    fullAddress: addressDoc.fullAddress,
    apartment: addressDoc.apartment,
    landmark: addressDoc.landmark,
    location: addressDoc.location,
    phone: addressDoc.phone,
  };

  // 4️⃣ Calculate amount
  const totalAmount = cart.items.reduce(
    (s, i) => s + i.priceAtAdd * i.qty,
    0
  );

  // 5️⃣ Create order
  const order = await Order.create({
    orderNumber: `ORD-${Date.now()}`,
    customer: userId,
    items: cart.items.map(i => ({
      product: i.product,
      name: i.name,
      variantIndex: i.variantIndex,
      qty: i.qty,
      price: i.priceAtAdd,
      subtotal: i.priceAtAdd * i.qty,
    })),
    totalAmount,
    payableAmount: totalAmount,
    address: addressSnapshot,
    status: "pending",
  });

  // 6️⃣ COD flow
  if (paymentMethod === "cod") {
    await PaymentTransaction.create({
      order: order._id,
      provider: "cod",
      amount: totalAmount,
      status: "success",
    });

    await confirmOrderLogic(order._id.toString());
    const updatedOrder = await Order.findById(order._id);

    return res.json({ order: updatedOrder, cod: true });
  }

  // 7️⃣ Razorpay flow
  const razorpayOrder = await razorpay.orders.create({
    amount: totalAmount * 100,
    currency: "INR",
    receipt: order.orderNumber,
    payment_capture: true,
  });

  await PaymentTransaction.create({
    order: order._id,
    provider: "razorpay",
    providerPaymentId: razorpayOrder.id,
    amount: totalAmount,
    status: "initiated",
  });

  res.json({
    orderId: order._id,
    razorpayOrderId: razorpayOrder.id,
    amount: totalAmount,
    currency: "INR",
  });
};

// controllers/payment.controller.ts
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

export const getInvoiceByOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const invoice = await Invoice.findOne({ order: orderId }).populate("order");
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  res.json(invoice);
};

export const getMyInvoices = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const invoices = await Invoice.find({ customer: userId }).sort({ createdAt: -1 });
  res.json(invoices);
};
