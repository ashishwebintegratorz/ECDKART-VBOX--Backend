import { Request, Response } from "express";
import { Zone } from "../models/Zone.model.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";

// @desc    Get all zones
// @route   GET /api/v1/zones
// @access  Private/Admin
export const getZones = asyncHandler(async (req: Request, res: Response) => {
  const zones = await Zone.find({}).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: zones });
});

// @desc    Create a new zone
// @route   POST /api/v1/zones
// @access  Private/Admin
export const createZone = asyncHandler(async (req: Request, res: Response) => {
  const { name, city, boundary, isActive } = req.body;

  if (!name || !city || !boundary) {
    res.status(400);
    throw new Error("Please provide name, city, and boundary data");
  }

  const zone = await Zone.create({
    name,
    city,
    boundary,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({ success: true, data: zone });
});

// @desc    Update a zone
// @route   PUT /api/v1/zones/:id
// @access  Private/Admin
export const updateZone = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, city, boundary, isActive } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (city !== undefined) updates.city = city;
  if (boundary !== undefined) updates.boundary = boundary;
  if (isActive !== undefined) updates.isActive = isActive;

  const zone = await Zone.findByIdAndUpdate(id, { $set: updates }, {
    new: true,
    runValidators: true,
  });

  if (!zone) {
    res.status(404);
    throw new Error("Zone not found");
  }

  res.status(200).json({ success: true, data: zone });
});

// @desc    Delete a zone
// @route   DELETE /api/v1/zones/:id
// @access  Private/Admin
export const deleteZone = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const zone = await Zone.findById(id);

  if (!zone) {
    res.status(404);
    throw new Error("Zone not found");
  }

  await zone.deleteOne();
  
  res.status(200).json({ success: true, message: "Zone removed successfully" });
});


// Public route for App
export const getActiveZones = asyncHandler(async (req: Request, res: Response) => { const zones = await Zone.find({ isActive: true }); res.status(200).json({ success: true, data: zones }); });

// Check if a point is within active zones
export const checkServiceability = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) {
    res.status(400);
    throw new Error('Latitude and longitude are required');
  }
  
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  
  const zone = await Zone.findOne({
    isActive: true,
    boundary: {
      $geoIntersects: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        }
      }
    }
  });
  
  if (zone) {
    res.status(200).json({ success: true, serviceable: true, zone: zone.name });
  } else {
    res.status(200).json({ success: true, serviceable: false });
  }
});