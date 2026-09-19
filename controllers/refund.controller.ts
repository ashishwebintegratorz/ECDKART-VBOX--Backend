import { Request, Response } from "express";
import Refund from "../models/Refund.model.js";

// @route   GET /api/v1/refunds
// @desc    Get all refunds for admin
// @access  Admin
export const getRefunds = async (req: Request, res: Response) => {
  try {
    const refunds = await Refund.find()
      .populate("order", "orderNumber totalAmount paymentMethod status")
      .populate("customer", "name phone email")
      .sort({ createdAt: -1 });

    res.json(refunds);
  } catch (err: any) {
    res.status(500).json({ message: "Error fetching refunds", error: err.message });
  }
};

// @route   PUT /api/v1/refunds/:id/process
// @desc    Process a refund
// @access  Admin
export const processRefund = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const refund = await Refund.findById(id);
    if (!refund) return res.status(404).json({ message: "Refund not found" });

    if (refund.status === "processed") {
      return res.status(400).json({ message: "Refund is already processed" });
    }

    refund.status = "processed";
    await refund.save();

    // Optionally: trigger Razorpay refund API here if real refund is needed programmatically

    res.json({ success: true, message: "Refund processed successfully", refund });
  } catch (err: any) {
    res.status(500).json({ message: "Error processing refund", error: err.message });
  }
};
