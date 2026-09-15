import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPayoutRequest extends Document {
  driver: Types.ObjectId;
  amount: number;
  status: "pending" | "approved" | "rejected";
  upiId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutRequestSchema = new Schema<IPayoutRequest>(
  {
    driver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [200, "Minimum payout request is ₹200"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    upiId: {
      type: String,
    },
  },
  { timestamps: true }
);

export const PayoutRequest = mongoose.model<IPayoutRequest>(
  "PayoutRequest",
  payoutRequestSchema
);
