import { Schema, model } from 'mongoose';

const PhoneAbuseLogSchema = new Schema({
  normalizedPhone: { type: String, required: true, index: true },
  attemptedByTelegramId: { type: Number, required: true },
  existingOwnerTelegramId: { type: Number },
  secondsSinceStart: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

export const PhoneAbuseLog = model('PhoneAbuseLog', PhoneAbuseLogSchema);