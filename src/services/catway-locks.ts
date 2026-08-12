import createError from 'http-errors';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { CatwayLock } from '../models/catway-lock.js';

const LEASE_DURATION_MS = 30_000;
const ACQUISITION_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 25;

function expirationFromNow(): Date {
  return new Date(Date.now() + LEASE_DURATION_MS);
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

async function tryAcquireLock(catwayNumber: number, owner: string): Promise<boolean> {
  const now = new Date();
  const expiredLock = await CatwayLock.findOneAndUpdate(
    { catwayNumber, expiresAt: { $lte: now } },
    { $set: { owner, expiresAt: expirationFromNow() } },
    { returnDocument: 'after' },
  );

  if (expiredLock) {
    return true;
  }

  try {
    await CatwayLock.create({ catwayNumber, owner, expiresAt: expirationFromNow() });
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return false;
    }

    throw error;
  }
}

async function acquireLock(catwayNumber: number, owner: string): Promise<void> {
  const deadline = Date.now() + ACQUISITION_TIMEOUT_MS;

  do {
    if (await tryAcquireLock(catwayNumber, owner)) {
      return;
    }

    await delay(RETRY_DELAY_MS);
  } while (Date.now() < deadline);

  throw createError(409, 'Une autre opération est en cours sur ce catway. Réessayez.');
}

async function refreshLock(catwayNumber: number, owner: string): Promise<void> {
  await CatwayLock.updateOne({ catwayNumber, owner }, { $set: { expiresAt: expirationFromNow() } });
}

async function releaseLock(catwayNumber: number, owner: string): Promise<void> {
  await CatwayLock.deleteOne({ catwayNumber, owner });
}

export async function withCatwayLock<T>(
  catwayNumber: number,
  operation: () => Promise<T>,
): Promise<T> {
  const owner = randomUUID();
  await acquireLock(catwayNumber, owner);

  const renewalTimer = setInterval(() => {
    void refreshLock(catwayNumber, owner).catch(() => undefined);
  }, LEASE_DURATION_MS / 3);
  renewalTimer.unref();

  try {
    return await operation();
  } finally {
    clearInterval(renewalTimer);
    await releaseLock(catwayNumber, owner);
  }
}
