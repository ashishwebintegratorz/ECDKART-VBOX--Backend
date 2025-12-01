import { Schema, model, Document, Types } from "mongoose";

export interface IAddress extends Document {
  user: Types.ObjectId;
  label?: string; // "Home", "Office"
  fullAddress: string; // user-entered formatted address
  apartment?: string;
  landmark?: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  phone?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String },
    fullAddress: { type: String, required: true },
    apartment: { type: String },
    landmark: { type: String },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    phone: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AddressSchema.index({ location: "2dsphere" });
AddressSchema.index({ user: 1, isDefault: 1 });

export default model<IAddress>("Address", AddressSchema);
