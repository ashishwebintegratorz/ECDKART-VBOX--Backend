import mongoose, { Schema, Document } from 'mongoose';

export interface IZone extends Document {
  name: string;
  city: string;
  boundary: any; // GeoJSON Polygon or MultiPolygon
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const zoneSchema = new Schema<IZone>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    boundary: {
      type: Schema.Types.Mixed,
      required: true,
      // Ideally a GeoJSON format: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Zone = mongoose.model<IZone>('Zone', zoneSchema);
