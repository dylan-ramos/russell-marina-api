import createError from 'http-errors';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { DistributedLock } from '../models/distributed-lock.js';

const LEASE_DURATION_MS = 30_000;
const ACQUISITION_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 25;

function expirationFromNow(): Date {
  return new Date(Date.now() + LEASE_DURATION_MS);
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

async function tryAcquireLock(resource: string, owner: string): Promise<boolean> {
  const expiredLock = await DistributedLock.findOneAndUpdate(
    { resource, expiresAt: { $lte: new Date() } },
    { $set: { owner, expiresAt: expirationFromNow() } },
    { returnDocument: 'after' },
  );

  if (expiredLock) {
    return true;
  }

  try {
    await DistributedLock.create({ resource, owner, expiresAt: expirationFromNow() });
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return false;
    }

    throw error;
  }
}

async function acquireLock(resource: string, owner: string): Promise<void> {
  const deadline = Date.now() + ACQUISITION_TIMEOUT_MS;

  do {
    if (await tryAcquireLock(resource, owner)) {
      return;
    }

    await delay(RETRY_DELAY_MS);
  } while (Date.now() < deadline);

  throw createError(409, 'Une autre opération est en cours. Réessayez.');
}

async function refreshLock(resource: string, owner: string): Promise<void> {
  await DistributedLock.updateOne(
    { resource, owner },
    { $set: { expiresAt: expirationFromNow() } },
  );
}

async function releaseLock(resource: string, owner: string): Promise<void> {
  await DistributedLock.deleteOne({ resource, owner });
}

export async function withDistributedLock<T>(
  resource: string,
  operation: () => Promise<T>,
): Promise<T> {
  const owner = randomUUID();
  await acquireLock(resource, owner);

  const renewalTimer = setInterval(() => {
    void refreshLock(resource, owner).catch(() => undefined);
  }, LEASE_DURATION_MS / 3);
  renewalTimer.unref();

  try {
    return await operation();
  } finally {
    clearInterval(renewalTimer);
    await releaseLock(resource, owner);
  }
}
