//src\core\database\models\Operator.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IOperator extends Document {
  operatorId: string;   // e.g., 'ethio_bingoobot'
  isActive: boolean;    // controls whether the bot accepts user interactions
  createdAt: Date;
  updatedAt: Date;
}

const OperatorSchema = new Schema<IOperator>(
  {
    operatorId: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Operator = mongoose.model<IOperator>('Operator', OperatorSchema);