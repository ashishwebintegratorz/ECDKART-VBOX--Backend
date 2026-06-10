import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import UserModel from "../models/User.model.js";
import OrderModel from "../models/Order.model.js";
import { getRoute } from "../services/ors.service.js";
import DeliveryHistoryModel from "../models/DeliveryHistory.model.js";
import cloudinary from "../config/cloudinary.js";

/**
 * Get all drivers with their busy status
 */
export const getAllDrivers = asyncHandler(async (req: Request, res: Response) => {
    const drivers = await UserModel.find({ role: "driver" }).select("name phone email avatar isOnline isReturning");

    const enhancedDrivers = await Promise.all(drivers.map(async (driver) => {
        const activeOrder = await OrderModel.findOne({
            assignedDriver: driver._id,
            deliveryStatus: { $in: ["assigned", "out_for_delivery"] }
        });
        return {
            ...driver.toObject(),
            isBusy: !!activeOrder || driver.isReturning
        };
    }));

    return res.json(enhancedDrivers);
});

/**
 * Get free drivers (Online and not busy)
 */
export const getFreeDrivers = asyncHandler(async (req: Request, res: Response) => {
    const onlineDrivers = await UserModel.find({ role: "driver", isOnline: true }).select("name phone email avatar isOnline isReturning");

    const freeDrivers = [];

    for (const driver of onlineDrivers) {
        const activeOrder = await OrderModel.findOne({
            assignedDriver: driver._id,
            deliveryStatus: { $in: ["assigned", "out_for_delivery"] }
        });

        if (!activeOrder && !driver.isReturning) {
            freeDrivers.push({
                ...driver.toObject(),
                isBusy: false
            });
        }
    }

    return res.json(freeDrivers);
});

/**
 * Toggle driver online/offline status
 */
export const toggleOnlineStatus = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { isOnline } = req.body;

    if (typeof isOnline !== "boolean") {
        return res.status(400).json({ message: "isOnline boolean is required" });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
        user._id,
        { isOnline },
        { new: true }
    );

    return res.json({ message: `Status updated to ${isOnline ? "Online" : "Offline"}`, user: updatedUser });
});

/**
 * Mark driver as reached store (reset isReturning)
 */
export const markReachedStoreStatus = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;

    const updatedUser = await UserModel.findByIdAndUpdate(
        user._id,
        { isReturning: false },
        { new: true }
    );

    return res.json({ message: "Welcome back! You are now available for new orders.", user: updatedUser });
});

/**
 * Get route between pickup and delivery location using ORS
 */
export const getDriverRoute = asyncHandler(async (req: Request, res: Response) => {
    const { pickupLng, pickupLat, deliveryLng, deliveryLat } = req.query;

    if (!pickupLng || !pickupLat || !deliveryLng || !deliveryLat) {
        return res.status(400).json({ message: "Both pickup and delivery coordinates are required" });
    }

    try {
        const startCoords: [number, number] = [Number(pickupLng), Number(pickupLat)];
        const endCoords: [number, number] = [Number(deliveryLng), Number(deliveryLat)];

        const route = await getRoute(startCoords, endCoords);
        
        // Simple pricing logic: ₹20 base + ₹10 per km
        const estimatedPrice = 20 + Math.round(route.distanceKm * 10);

        return res.json({
            route,
            estimatedPrice
        });
    } catch (error: any) {
        return res.status(500).json({ message: error.message || "Failed to calculate route" });
    }
});

/**
 * Mark a pickup/delivery as complete and save history with pricing
 */
export const completeDelivery = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { 
        orderId, 
        pickupAddress, 
        pickupLng, 
        pickupLat,
        deliveryAddress,
        deliveryLng,
        deliveryLat,
        customerName,
        distanceKm,
        calculatedPrice
    } = req.body;

    if (!orderId || !pickupAddress || !deliveryAddress || !customerName) {
        return res.status(400).json({ message: "Missing required fields for completing delivery" });
    }

    const deliveryHistory = await DeliveryHistoryModel.create({
        driver: user._id,
        order: orderId,
        pickupAddress,
        pickupLocation: {
            type: "Point",
            coordinates: [Number(pickupLng), Number(pickupLat)]
        },
        deliveryAddress,
        deliveryLocation: {
            type: "Point",
            coordinates: [Number(deliveryLng), Number(deliveryLat)]
        },
        customerName,
        distanceKm,
        calculatedPrice,
        status: "completed"
    });

    // Optionally update the order status
    await OrderModel.findByIdAndUpdate(orderId, { deliveryStatus: "delivered", status: "delivered" });

    // Mark driver as returning to store since delivery is complete
    await UserModel.findByIdAndUpdate(user._id, { isReturning: true });

    return res.status(201).json({
        message: "Delivery completed and history saved successfully",
        deliveryHistory
    });
});

// -------------------------------
// Cloudinary Upload Helper
// -------------------------------
const uploadToCloudinary = (file: Express.Multer.File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "drivers" },
      (err, result) => {
        if (err || !result) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
};

/**
 * Onboard Driver
 */
export const onboardDriver = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { name, upiId } = req.body;

    if (!name || !upiId) {
        return res.status(400).json({ message: "Name and UPI ID are required" });
    }

    const file = req.file as Express.Multer.File;
    if (!file) {
        return res.status(400).json({ message: "Driving License image is required" });
    }

    // Upload to cloudinary
    const drivingLicenseUrl = await uploadToCloudinary(file);

    // Update user profile
    const updatedUser = await UserModel.findByIdAndUpdate(
        user._id,
        {
            role: "driver",
            name,
            driverDetails: {
                upiId,
                drivingLicense: drivingLicenseUrl
            }
        },
        { new: true }
    );

    return res.status(200).json({
        message: "Driver onboarded successfully",
        user: updatedUser
    });
});

