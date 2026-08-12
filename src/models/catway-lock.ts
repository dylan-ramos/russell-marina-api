import { model, Schema } from 'mongoose';

export interface CatwayLockDocument {
  catwayNumber: number;
  owner: string;
  expiresAt: Date;
}

const catwayLockSchema = new Schema<CatwayLockDocument>(
  {
    catwayNumber: { type: Number, required: true, unique: true, min: 1 },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

catwayLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CatwayLock = model<CatwayLockDocument>('CatwayLock', catwayLockSchema);
