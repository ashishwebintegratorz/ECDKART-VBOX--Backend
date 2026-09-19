import { Schema, model, Document, Types } from "mongoose";

export interface IRefund extends Document {
  order: Types.ObjectId;
  customer: Types.ObjectId;
  amount: number;
  status: "pending" | "processed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "processed", "failed"], default: "pending", index: true },
  },
  { timestamps: true }
);

export default model<IRefund>("Refund", RefundSchema);
