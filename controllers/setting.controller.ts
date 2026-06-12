import { Request, Response } from "express";
import { Setting } from "../models/Setting.model.js";

// Get all settings (Public API so user app can access)
export const getSettings = async (req: Request, res: Response) => {
  const settings = await Setting.find();
  const settingsMap = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, any>);
  
  res.json({ success: true, settings: settingsMap });
};

// Update a specific setting (Admin Only)
export const updateSetting = async (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!key) {
    return res.status(400).json({ success: false, message: "Setting key is required" });
  }

  const setting = await Setting.findOneAndUpdate(
    { key },
    { value },
    { new: true, upsert: true }
  );

  res.json({ success: true, setting });
};
