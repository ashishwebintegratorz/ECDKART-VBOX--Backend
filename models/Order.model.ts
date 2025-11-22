import { Schema, model, Document, Types } from "mongoose";

export interface IOrderItem {
  product: Types.ObjectId;
  quantity: number;
  price: number;
  name?: string;
}

export interface IOrder extends Document {
  customer: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  address: string;
  status: string;
  driver?: Types.ObjectId;
}

const OrderSchema = new Schema<IOrder>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true },
        name: { type: String },
      },
    ],
    totalAmount: { type: Number, required: true },
    address: { type: String, required: true },
    status: { type: String, default: "pending" },
    driver: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default model<IOrder>("Order", OrderSchema);
