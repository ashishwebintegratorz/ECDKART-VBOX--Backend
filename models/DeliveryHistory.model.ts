import { Schema, model, Document, Types } from "mongoose";

export interface IDeliveryHistory extends Document {
  driver: Types.ObjectId;
  order: Types.ObjectId;
  pickupAddress: string;
  pickupLocation: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  deliveryAddress: string;
  deliveryLocation: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  customerName: string;
  distanceKm: number;
  calculatedPrice: number;
  status: string; // e.g., "completed"
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryHistorySchema = new Schema<IDeliveryHistory>(
  {
    driver: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    pickupAddress: { type: String, required: true },
    pickupLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    deliveryAddress: { type: String, required: true },
    deliveryLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    customerName: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    calculatedPrice: { type: Number, required: true },
    status: { type: String, default: "completed" },
  },
  { timestamps: true }
);

DeliveryHistorySchema.index({ "pickupLocation": "2dsphere" });
DeliveryHistorySchema.index({ "deliveryLocation": "2dsphere" });

export default model<IDeliveryHistory>("DeliveryHistory", DeliveryHistorySchema);
