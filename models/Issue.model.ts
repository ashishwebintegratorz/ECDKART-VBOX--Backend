import mongoose, { Document, Schema, Types } from "mongoose";

export interface IIssue extends Document {
  order: Types.ObjectId;
  user: Types.ObjectId;
  description: string;
  status: "open" | "resolved";
  createdAt: Date;
  updatedAt: Date;
}

const issueSchema = new Schema<IIssue>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
  },
  { timestamps: true }
);

export const IssueModel = mongoose.model<IIssue>("Issue", issueSchema);
