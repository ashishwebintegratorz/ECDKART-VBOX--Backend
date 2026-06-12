import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import UserModel from "../models/User.model.js";
import OrderModel from "../models/Order.model.js";
import { getRoute } from "../services/ors.service.js";
import DeliveryHistoryModel from "../models/DeliveryHistory.model.js";
import cloudinary from "../config/cloudinary.js";
import bcrypt from "bcrypt";

/**
 * Get all drivers with their busy status
 */
export const getAllDrivers = asyncHandler(async (req: Request, res: Response) => {
    const drivers = await UserModel.find({ role: "driver" }).select("name phone email avatar isOnline isReturning driverDetails");

    const activeOrders = await OrderModel.find({
        deliveryStatus: { $in: ["assigned", "out_for_delivery"] }
    }).select("assignedDriver");

    const busyDriverIds = new Set(activeOrders.map(order => order.assignedDriver?.toString()));

    const enhancedDrivers = drivers.map(driver => ({
        ...driver.toObject(),
        isBusy: busyDriverIds.has(driver._id.toString()) || driver.isReturning
    }));

    return res.json(enhancedDrivers);
});

/**
 * Get free drivers (Online and not busy)
 */
export const getFreeDrivers = asyncHandler(async (req: Request, res: Response) => {
    const onlineDrivers = await UserModel.find({ role: "driver", isOnline: true }).select("name phone email avatar isOnline isReturning");

    const activeOrders = await OrderModel.find({
        deliveryStatus: { $in: ["assigned", "out_for_delivery"] }
    }).select("assignedDriver");

    const busyDriverIds = new Set(activeOrders.map(order => order.assignedDriver?.toString()));

    const freeDrivers = onlineDrivers.filter(driver => {
        const isBusy = busyDriverIds.has(driver._id.toString());
        return !isBusy && !driver.isReturning;
    }).map(driver => driver.toObject());

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
 * Update Driver Location
 */
export const updateDriverLocation = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { lat, lng, speed, heading } = req.body;

    if (lat === undefined || lng === undefined) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const DriverLocationModel = (await import("../models/DriverLocation.model.js")).default;

    const locationData = {
        driver: user._id,
        location: {
            type: "Point",
            coordinates: [lng, lat] // GeoJSON expects [longitude, latitude]
        },
        speed,
        heading
    };

    const updatedLocation = await DriverLocationModel.findOneAndUpdate(
        { driver: user._id },
        locationData,
        { new: true, upsert: true }
    );

    return res.json({ message: "Location updated successfully", location: updatedLocation });
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
    // Admin is making the request, so we don't use req.user._id to update.
    const { name, upiId, phone, pin, driverId } = req.body;

    if (!name || !upiId || !phone || !pin) {
        return res.status(400).json({ message: "Name, phone, PIN, and UPI ID are required" });
    }

    const file = req.file as Express.Multer.File;
    if (!file) {
        return res.status(400).json({ message: "Driving License image is required" });
    }

    // Ensure phone has country code prefix
    let formattedPhone = phone;
    if (!formattedPhone.startsWith("+")) {
        // Assume India +91 if no prefix
        formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`;
    }

    // Hash the PIN
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    // Upload to cloudinary
    const drivingLicenseUrl = await uploadToCloudinary(file);

    // Find or create user by phone
    const updatedUser = await UserModel.findOneAndUpdate(
        { phone: formattedPhone },
        {
            $set: {
                role: "driver",
                name,
                pinHash,
                driverDetails: {
                    upiId,
                    drivingLicense: drivingLicenseUrl,
                    driverId
                }
            }
        },
        { new: true, upsert: true }
    );

    return res.status(200).json({
        message: "Driver onboarded successfully",
        user: updatedUser
    });
});

/**
 * Get Today's Driver Summary
 */
export const getDriverSummary = asyncHandler(async (req: Request, res: Response) => {
  const driverId = req.user.id;
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayOrders = await OrderModel.find({
    assignedDriver: driverId,
    deliveryStatus: "delivered",
    updatedAt: { $gte: startOfDay, $lte: endOfDay }
  });

  const orders_completed = todayOrders.length;
  // Calculate earnings, defaulting to 40 per order
  const earnings = todayOrders.reduce((sum, order) => sum + ((order as any).deliveryFee || 40), 0);

  res.json({
    earnings,
    orders_completed,
    ride_time_seconds: 0
  });
});

/**
 * Admin: Get Driver Details
 */
export const getDriverDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const driver = await UserModel.findOne({ _id: id, role: "driver" });
    
    if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
    }

    // Get lifetime stats
    const allOrders = await OrderModel.find({ assignedDriver: id, deliveryStatus: "delivered" });
    const totalOrders = allOrders.length;
    const totalEarnings = allOrders.reduce((sum, order) => sum + ((order as any).deliveryFee || 40), 0);

    return res.json({
        driver,
        stats: {
            totalOrders,
            totalEarnings
        }
    });
});

/**
 * Admin: Update Driver Details
 */
export const updateDriverDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, phone, upiId, driverId } = req.body;

    const driver = await UserModel.findOne({ _id: id, role: "driver" });
    if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
    }

    if (name) driver.name = name;
    if (phone) driver.phone = phone;
    if (upiId && driver.driverDetails) {
        driver.driverDetails.upiId = upiId;
    }
    if (driverId && driver.driverDetails) {
        driver.driverDetails.driverId = driverId;
    }

    await driver.save();
    return res.json({ message: "Driver updated successfully", driver });
});

/**
 * Admin: Delete Driver
 */
export const deleteDriver = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const driver = await UserModel.findOne({ _id: id, role: "driver" });
    if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
    }

    // Unassign pending orders? Optionally handle here.
    
    await UserModel.findByIdAndDelete(id);
    return res.json({ message: "Driver deleted successfully" });
});
