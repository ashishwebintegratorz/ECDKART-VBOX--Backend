import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  price: number;
  stock: number;
  images: string[]; // URLs from Cloudinary
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default model<IProduct>("Product", ProductSchema);
