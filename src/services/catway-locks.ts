import { withDistributedLock } from './distributed-locks.js';

export async function withCatwayLock<T>(
  catwayNumber: number,
  operation: () => Promise<T>,
): Promise<T> {
  return withDistributedLock(`catway:${catwayNumber}`, operation);
}
