import { Request, Response } from "express";
import Category from "../models/Category.model.js";
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

// Create slug helper
const toSlug = (name: string) =>
  name.toLowerCase().trim().replace(/\s+/g, "-");

// ----------------------------
// 1️⃣ Add Category
// ----------------------------
export const addCategory = async (req: Request, res: Response) => {
  const { name, parent, ordering } = req.body;

  if (!name) {
    throw new BadRequestException("Category name is required");
  }

  const slug = toSlug(name);

  // Avoid duplicate
  const exists = await Category.findOne({ slug });
  if (exists) {
    throw new BadRequestException("Category already exists");
  }

  let image = "";
  if (req.file) {
    image = await uploadToCloudinary(req.file, "categories");
  }

  const category = await Category.create({
    name,
    slug,
    image,
    parent: parent || null,
    ordering: ordering || 0,
  });

  return res.status(201).json({
    message: "Category created successfully",
    category,
  });
};

// ----------------------------
// 2️⃣ Get All Categories
// ----------------------------
export const getAllCategories = async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ ordering: 1, name: 1 });

  return res.json({
    categories,
  });
};

// ----------------------------
// 3️⃣ Get Category By ID
// ----------------------------
export const getCategoryById = async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    throw new NotFoundException("Category not found");
  }

  return res.json({ category });
};

// ----------------------------
// 4️⃣ Update Category
// ----------------------------
export const updateCategory = async (req: Request, res: Response) => {
  const { name, parent, ordering } = req.body;

  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new NotFoundException("Category not found");
  }

  const slug = name ? toSlug(name) : category.slug;
  
  let image = category.image;
  if (req.file) {
    image = await uploadToCloudinary(req.file, "categories");
  }

  const updated = await Category.findByIdAndUpdate(
    req.params.id,
    {
      name: name ?? category.name,
      slug,
      image,
      parent: parent ?? category.parent,
      ordering: ordering ?? category.ordering,
    },
    { new: true }
  );

  return res.json({
    message: "Category updated",
    category: updated,
  });
};

// ----------------------------
// 5️⃣ Delete Category
// ----------------------------
export const deleteCategory = async (req: Request, res: Response) => {
  const category = await Category.findByIdAndDelete(req.params.id);

  if (!category) {
    throw new NotFoundException("Category not found");
  }

  return res.json({
    message: "Category deleted successfully",
  });
};
