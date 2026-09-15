import { Schema, model, Document } from "mongoose";

export interface ICategory extends Document {
  name: string;
  slug: string;
  image?: string; // Image URL for the category
  parent?: string | null;
  ordering?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true, unique: true },
    image: { type: String, default: "" }, // Default empty string or could be omitted
    parent: { type: String, default: null },
    ordering: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model<ICategory>("Category", CategorySchema);
