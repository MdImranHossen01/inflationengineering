import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISupplierBillItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ISupplierBill extends Document {
  supplier: mongoose.Types.ObjectId | string;
  billNo: string;
  date: Date;
  items: ISupplierBillItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: 'Paid' | 'Partially Paid' | 'Due';
  paymentMethod?: 'Cash' | 'Bank';
  createdAt: Date;
  updatedAt: Date;
}

const SupplierBillSchema: Schema<ISupplierBill> = new Schema(
  {
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    billNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['Paid', 'Partially Paid', 'Due'],
      default: 'Due',
    },
    paymentMethod: { type: String, enum: ['Cash', 'Bank'] },
  },
  { timestamps: true }
);

const SupplierBill: Model<ISupplierBill> =
  mongoose.models.SupplierBill || mongoose.model<ISupplierBill>('SupplierBill', SupplierBillSchema);

export default SupplierBill;
