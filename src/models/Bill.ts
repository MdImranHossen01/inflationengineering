/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBillItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

export interface IBill extends Document {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress: string;
  invoiceNo: string;
  date: Date;
  items: IBillItem[];
  subtotal: number;
  deliveryCharge: number;
  serviceFee: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  discount: number;
  total: number;
  prevDue: number;
  gTotal: number;
  cashIn: number;
  currentBillDue: number;
  status: 'Paid' | 'Due';
  expectedReceivableDate?: Date;
  expectedDeliveryDate?: Date | string;
  termsAndConditions?: string;
  vatTaxIncluded?: boolean;
  documentType?: 'offer' | 'chalan' | 'bill';
  convertedFrom?: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const BillSchema: Schema<IBill> = new Schema(
  {
    clientName: { type: String, required: true },
    clientPhone: { type: String, required: true },
    clientEmail: { type: String },
    clientAddress: { type: String, required: true },
    invoiceNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    items: [
      {
        name: { type: String, required: true },
        description: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    serviceFee: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    discountValue: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    prevDue: { type: Number, default: 0, min: 0 },
    gTotal: { type: Number, required: true, min: 0 },
    cashIn: { type: Number, default: 0, min: 0 },
    currentBillDue: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Paid', 'Due'], default: 'Due' },
    expectedReceivableDate: { type: Date },
    expectedDeliveryDate: { type: Schema.Types.Mixed },
    termsAndConditions: { type: String },
    vatTaxIncluded: { type: Boolean, default: true },
    documentType: { type: String, enum: ['offer', 'chalan', 'bill'], default: 'bill' },
    convertedFrom: { type: Schema.Types.ObjectId, ref: 'Bill' },
  },
  { timestamps: true }
);

if (mongoose.models && mongoose.models.Bill) {
  delete (mongoose.models as any).Bill;
}
const Bill: Model<IBill> = mongoose.models.Bill || mongoose.model<IBill>('Bill', BillSchema);

export default Bill;
