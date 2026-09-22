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
        isBusy: busyDriverIds.has(driver._id.toString())
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
        return !isBusy;
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

/**
 * Get COD Estimate for a Driver
 * Used by both Driver App (for their own profile) and Admin Panel
 */
export const getDriverCODEstimate = asyncHandler(async (req: Request, res: Response) => {
    // If Admin is requesting, driver ID comes from params. If driver is requesting, from req.user
    const driverId = req.params.id || req.user.id;
    
    const pendingCodOrders = await OrderModel.find({
        assignedDriver: driverId,
        paymentMethod: "cod",
        deliveryStatus: "delivered",
        codSettledWithAdmin: false
    });
    
    // To get driver earnings for these specific orders, we lookup DeliveryHistory
    const orderIds = pendingCodOrders.map(o => o._id);
    const histories = await DeliveryHistoryModel.find({
        order: { $in: orderIds }
    });
    
    let totalCODCollected = 0;
    let driverEarnings = 0;
    
    const ordersDetails = pendingCodOrders.map(order => {
        const orderAmount = order.payableAmount || 0;
        totalCODCollected += orderAmount;
        
        let orderEarnings = 40; // fallback flat fee
        const history = histories.find(h => h.order?.toString() === order._id.toString());
        if (history && history.calculatedPrice) {
            orderEarnings = history.calculatedPrice;
        }
        driverEarnings += orderEarnings;

        return {
            _id: order._id,
            orderNumber: order.orderNumber,
            payableAmount: orderAmount,
            driverEarnings: orderEarnings,
            createdAt: order.createdAt,
            status: order.status
        };
    });
    
    const netAmountToAdmin = totalCODCollected - driverEarnings;
    
    return res.json({
        totalCODCollected,
        driverEarnings,
        netAmountToAdmin,
        pendingOrderCount: pendingCodOrders.length,
        orders: ordersDetails
    });
});

/**
 * Admin: Settle Driver COD
 */
export const adminSettleDriverCOD = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // Driver ID
    
    const pendingCodOrders = await OrderModel.find({
        assignedDriver: id,
        paymentMethod: "cod",
        deliveryStatus: "delivered",
        codSettledWithAdmin: false
    });
    
    if (pendingCodOrders.length === 0) {
        return res.status(400).json({ message: "No pending COD to settle for this driver." });
    }
    
    // Mark them as settled
    const orderIds = pendingCodOrders.map(o => o._id);
    await OrderModel.updateMany(
        { _id: { $in: orderIds } },
        { $set: { codSettledWithAdmin: true } }
    );
    
    return res.json({
        message: "COD Settled successfully.",
        settledOrdersCount: orderIds.length
    });
});

/**
 * Admin: Get All Drivers COD Estimates
 * Used by Admin Panel to see all pending COD settlements in one view
 */
export const getAllDriversCODEstimates = asyncHandler(async (req: Request, res: Response) => {
    // 1. Get all pending COD orders
    const pendingCodOrders = await OrderModel.find({
        paymentMethod: "cod",
        deliveryStatus: "delivered",
        codSettledWithAdmin: false
    }).populate('assignedDriver', 'name phone email avatar driverDetails');

    // 2. Get delivery histories for these orders
    const orderIds = pendingCodOrders.map(o => o._id);
    const histories = await DeliveryHistoryModel.find({
        order: { $in: orderIds }
    });

    // 3. Group by driver
    const driverEstimates: Record<string, any> = {};

    pendingCodOrders.forEach(order => {
        if (!order.assignedDriver) return;
        
        const driverId = (order.assignedDriver as any)._id.toString();
        
        if (!driverEstimates[driverId]) {
            driverEstimates[driverId] = {
                driver: order.assignedDriver,
                totalCODCollected: 0,
                driverEarnings: 0,
                pendingOrderCount: 0,
            };
        }

        const estimate = driverEstimates[driverId];
        estimate.pendingOrderCount += 1;
        estimate.totalCODCollected += order.payableAmount || 0;

        const history = histories.find(h => h.order?.toString() === order._id.toString());
        if (history && history.calculatedPrice) {
            estimate.driverEarnings += history.calculatedPrice;
        } else {
            estimate.driverEarnings += 40; // fallback flat fee
        }
    });

    // 4. Calculate net amount for each and convert to array
    const result = Object.values(driverEstimates).map(estimate => ({
        ...estimate,
        netAmountToAdmin: estimate.totalCODCollected - estimate.driverEarnings
    }));

    // Sort by highest pending amount first
    result.sort((a, b) => b.netAmountToAdmin - a.netAmountToAdmin);

    return res.json({
        success: true,
        data: result
    });
});

import { PayoutRequest } from "../models/PayoutRequest.model.js";

/**
 * Get Wallet Summary for Driver
 */
export const getWalletSummary = asyncHandler(async (req: Request, res: Response) => {
    const driverId = req.user?.id;
    if (!driverId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Calculate total earnings
    const deliveries = await DeliveryHistoryModel.find({ driverId });
    let totalEarnings = 0;
    deliveries.forEach(d => {
        if (d.calculatedPrice) totalEarnings += d.calculatedPrice;
        else totalEarnings += 40;
    });

    // Calculate total payouts (approved + pending)
    const payouts = await PayoutRequest.find({ driver: driverId });
    let totalPayouts = 0;
    payouts.forEach(p => {
        totalPayouts += p.amount;
    });

    const balance = totalEarnings - totalPayouts;
    
    // Get today's orders
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayOrders = await OrderModel.countDocuments({
        assignedDriver: driverId,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    return res.json({
        success: true,
        data: {
            balance,
            billable_hours: 0,
            today_orders: todayOrders,
            recent_requests: payouts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5)
        }
    });
});

/**
 * Request Wallet Withdrawal
 */
export const requestWithdrawal = asyncHandler(async (req: Request, res: Response) => {
    const driverId = req.user?.id;
    const { amount } = req.body;
    
    if (!driverId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    if (!amount || amount < 200) {
        return res.status(400).json({ success: false, message: "Minimum withdrawal is ?200" });
    }
    
    const payout = new PayoutRequest({
        driver: driverId,
        amount,
        status: "pending"
    });
    
    await payout.save();
    
    return res.json({
        success: true,
        data: payout,
        message: "Payout request submitted successfully"
    });
});

