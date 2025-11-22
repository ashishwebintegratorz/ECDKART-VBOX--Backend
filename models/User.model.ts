import { Schema, model, Document } from "mongoose";

export type UserRole = "customer" | "driver" | "admin";

export interface IUser extends Document {
  phone: string;
  name?: string;
  role: UserRole;
  isVerified: boolean;
  pinHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
    },
    role: {
      type: String,
      enum: ["customer", "driver", "admin"],
      default: "customer",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    pinHash: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

export default model<IUser>("User", UserSchema);
