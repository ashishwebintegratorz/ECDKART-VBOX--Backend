import { Schema, model, Document, Types } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  description?: string;
  image?: string;
  title?: string;
  message?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderValue?: number;
  maxDiscountValue?: number;
  usageLimit?: number;
  perUserLimit?: number;
  validFrom?: Date;
  validTo?: Date;
  active: boolean;
  applicableProducts?: Types.ObjectId[];
  usedBy?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    image: { type: String },
    title: { type: String },
    message: { type: String },
    discountType: { type: String, enum: ["percent", "fixed"], required: true },
    discountValue: { type: Number, required: true },
    minOrderValue: { type: Number },
    maxDiscountValue: { type: Number },
    usageLimit: { type: Number },
    perUserLimit: { type: Number },
    validFrom: { type: Date },
    validTo: { type: Date },
    active: { type: Boolean, default: true },
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    usedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default model<ICoupon>("Coupon", CouponSchema);
