import { Schema, model, Document, Types } from "mongoose";

export interface INotification extends Document {
  user?: Types.ObjectId;
  title: string;
  body: string;
  image?: string;
  type?: string;
  data?: Record<string, any>; // payload for client
  read?: boolean;
  targetGroup?: 'ALL_USERS' | 'ALL_DRIVERS' | 'SPECIFIC_USERS' | 'SPECIFIC_DRIVERS' | 'SPECIFIC';
  targetUsers?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    image: { type: String },
    type: { type: String },
    data: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    targetGroup: { type: String, enum: ['ALL_USERS', 'ALL_DRIVERS', 'SPECIFIC_USERS', 'SPECIFIC_DRIVERS', 'SPECIFIC'] },
    targetUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default model<INotification>("Notification", NotificationSchema);
