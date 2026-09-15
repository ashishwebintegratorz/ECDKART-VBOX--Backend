import { Schema, model, Document } from "mongoose";

export interface IBanner extends Document {
  title?: string;
  imageUrl: string;
  linkType?: string; // e.g. "product" or "category"
  linkId?: string;   // Optional ID of the linked product or category
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, default: "" },
    imageUrl: { type: String, required: true },
    linkType: { type: String, default: "" },
    linkId: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model<IBanner>("Banner", BannerSchema);
