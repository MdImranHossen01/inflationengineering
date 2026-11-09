import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITransactionCategory extends Document {
  name: string;
  type: 'expense' | 'income';
  createdAt: Date;
  updatedAt: Date;
}

const TransactionCategorySchema: Schema<ITransactionCategory> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a category name'],
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['expense', 'income'],
    },
  },
  { timestamps: true }
);

// Ensure a category name is unique per type
TransactionCategorySchema.index({ name: 1, type: 1 }, { unique: true });

const TransactionCategory: Model<ITransactionCategory> = 
  mongoose.models.TransactionCategory || mongoose.model<ITransactionCategory>('TransactionCategory', TransactionCategorySchema);

export default TransactionCategory;
