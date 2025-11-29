import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import Product from "../models/Product.model.js";
import cloudinary from "../config/cloudinary.js";
import { deleteCloudinaryImage } from "../utils/deleteCloudinaryImage.js";
import { NotFoundException } from "../utils/appError.js";

import type { File } from "multer";

export const addProduct = asyncHandler(async (req: Request & { files?: File[] }, res: Response) => {
  const { name, price, stock } = req.body;
  const files = req.files ?? [];

  if (!files || files.length === 0) {
    return res.status(400).json({ message: "Product images are required" });
  }

  // Upload all images to Cloudinary
  const imageUploadPromises = files.map(file =>
    cloudinary.uploader.upload_stream({ folder: "products" }, (error, result) => {})
  );

  // FIX: cloudinary upload with buffer
  const imageUrls: string[] = [];

  for (const file of files) {
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "veg-and-fruits" },
        (err, result) => {
          if (err || !result) reject(err);
          else resolve(result.secure_url);
        }
      );
      stream.end(file.buffer);
    });

    imageUrls.push(uploaded as string);
  }

  const product = await Product.create({
    name,
    price,
    stock,
    images: imageUrls,
  });

  res.json({
    message: "Product created successfully",
    product,
  });
});

// get all products

export const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  let {
    page = 1,
    limit = 10,
    search = "",
    minPrice,
    maxPrice,
    minStock,
    maxStock,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  page = Number(page);
  limit = Number(limit);

  // Query object
  const query: any = {};

  // Search by name
  if (search) {
    query.name = { $regex: search, $options: "i" }; // case insensitive
  }

  // Price filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // Stock filter
  if (minStock || maxStock) {
    query.stock = {};
    if (minStock) query.stock.$gte = Number(minStock);
    if (maxStock) query.stock.$lte = Number(maxStock);
  }

  // Sorting
  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  // Get total items for pagination
  const total = await Product.countDocuments(query);

  // Fetch products
  const products = await Product.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  return res.json({
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    products,
  });
});

//delete product by id
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) throw new NotFoundException("Product not found");

  // Delete product images from Cloudinary
  for (const img of product.images) {
    await deleteCloudinaryImage(img);
  }

  // Delete product from DB
  await product.deleteOne();

  return res.json({
    success: true,
    message: "Product deleted successfully",
  });
});
