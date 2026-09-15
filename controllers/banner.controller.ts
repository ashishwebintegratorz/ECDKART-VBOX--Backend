import { Request, Response } from "express";
import Banner from "../models/Banner.model.js";
import { BadRequestException, NotFoundException } from "../utils/appError.js";
import cloudinary from "../config/cloudinary.js";

const uploadToCloudinary = (file: Express.Multer.File, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (err, result) => {
        if (err || !result) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
};

// ----------------------------
// 1️⃣ Add Banner
// ----------------------------
export const addBanner = async (req: Request, res: Response) => {
  const { title, linkType, linkId, isActive } = req.body;

  let imageUrl = "";
  if (req.file) {
    imageUrl = await uploadToCloudinary(req.file, "banners");
  } else {
    throw new BadRequestException("Banner image is required");
  }

  const banner = await Banner.create({
    title: title || "",
    imageUrl,
    linkType: linkType || "",
    linkId: linkId || "",
    isActive: isActive === "false" || isActive === false ? false : true,
  });

  return res.status(201).json({
    message: "Banner created successfully",
    banner,
  });
};

// ----------------------------
// 2️⃣ Get All Banners
// ----------------------------
export const getAllBanners = async (_req: Request, res: Response) => {
  // Sort by newest first
  const banners = await Banner.find().sort({ createdAt: -1 });

  return res.json({
    banners,
  });
};

// ----------------------------
// 3️⃣ Get Active Banners (For frontend User App)
// ----------------------------
export const getActiveBanners = async (_req: Request, res: Response) => {
  const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });

  return res.json({
    banners,
  });
};

// ----------------------------
// 4️⃣ Update Banner
// ----------------------------
export const updateBanner = async (req: Request, res: Response) => {
  const { title, linkType, linkId, isActive } = req.body;

  const banner = await Banner.findById(req.params.id);
  if (!banner) {
    throw new NotFoundException("Banner not found");
  }

  let imageUrl = banner.imageUrl;
  if (req.file) {
    imageUrl = await uploadToCloudinary(req.file, "banners");
  }

  const updated = await Banner.findByIdAndUpdate(
    req.params.id,
    {
      title: title !== undefined ? title : banner.title,
      imageUrl,
      linkType: linkType !== undefined ? linkType : banner.linkType,
      linkId: linkId !== undefined ? linkId : banner.linkId,
      isActive: isActive !== undefined ? (isActive === "true" || isActive === true) : banner.isActive,
    },
    { new: true }
  );

  return res.json({
    message: "Banner updated successfully",
    banner: updated,
  });
};

// ----------------------------
// 5️⃣ Delete Banner
// ----------------------------
export const deleteBanner = async (req: Request, res: Response) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);

  if (!banner) {
    throw new NotFoundException("Banner not found");
  }

  return res.json({
    message: "Banner deleted successfully",
  });
};
