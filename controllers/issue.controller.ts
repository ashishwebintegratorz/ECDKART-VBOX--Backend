import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { IssueModel } from "../models/Issue.model.js";

/**
 * @desc    Create a new issue/report
 * @route   POST /api/issues
 * @access  Private (User)
 */
export const createIssue = asyncHandler(async (req: Request, res: Response) => {
    const { orderId, description } = req.body;
    const userId = req.user?.id;

    if (!orderId || !description) {
        return res.status(400).json({ success: false, message: "Order ID and description are required" });
    }

    const issue = new IssueModel({
        order: orderId,
        user: userId,
        description,
        status: "open",
    });

    await issue.save();

    return res.status(201).json({
        success: true,
        data: issue,
        message: "Issue reported successfully",
    });
});

/**
 * @desc    Get all issues
 * @route   GET /api/issues/admin
 * @access  Private (Admin)
 */
export const getAllIssues = asyncHandler(async (req: Request, res: Response) => {
    const issues = await IssueModel.find()
        .populate("order", "orderNumber payableAmount deliveryStatus")
        .populate("user", "name phone email")
        .sort({ createdAt: -1 });

    return res.json({
        success: true,
        data: issues,
    });
});

/**
 * @desc    Resolve an issue
 * @route   PUT /api/issues/:id/resolve
 * @access  Private (Admin)
 */
export const resolveIssue = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const issue = await IssueModel.findById(id);
    if (!issue) {
        return res.status(404).json({ success: false, message: "Issue not found" });
    }

    issue.status = "resolved";
    await issue.save();

    return res.json({
        success: true,
        data: issue,
        message: "Issue resolved successfully",
    });
});
