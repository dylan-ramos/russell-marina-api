import { model, Schema } from 'mongoose';

export interface DistributedLockDocument {
  resource: string;
  owner: string;
  expiresAt: Date;
}

const distributedLockSchema = new Schema<DistributedLockDocument>(
  {
    resource: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

distributedLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DistributedLock = model<DistributedLockDocument>(
  'DistributedLock',
  distributedLockSchema,
);
