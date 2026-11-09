import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  phone: string;
  email?: string;
  address: string;
  companyName?: string;
  currentBalance: number; // Positive balance means we owe them (liability)
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema: Schema<ISupplier> = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    companyName: { type: String },
    currentBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Supplier: Model<ISupplier> =
  mongoose.models.Supplier || mongoose.model<ISupplier>('Supplier', SupplierSchema);

export default Supplier;
