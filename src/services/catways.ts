import createError from 'http-errors';
import type { HydratedDocument } from 'mongoose';

import { CATWAY_TYPES, Catway, type CatwayDocument, type CatwayType } from '../models/catway.js';
import { Reservation } from '../models/reservation.js';
import { withCatwayLock } from './catway-locks.js';

export interface CatwayInput {
  catwayNumber: unknown;
  catwayType: unknown;
  catwayState: unknown;
}

type CatwayEntity = HydratedDocument<CatwayDocument>;

function isCatwayType(value: unknown): value is CatwayType {
  return CATWAY_TYPES.some((catwayType) => catwayType === value);
}

export async function findAllCatways(): Promise<CatwayEntity[]> {
  return Catway.find().sort({ catwayNumber: 1 });
}

export async function findCatway(catwayNumber: number): Promise<CatwayEntity> {
  const catway = await Catway.findOne({ catwayNumber });
  if (!catway) {
    throw createError(404, `Le catway ${catwayNumber} n'existe pas.`);
  }

  return catway;
}

export async function createCatway(input: CatwayInput): Promise<CatwayEntity> {
  if (!isCatwayType(input.catwayType)) {
    throw createError(422, 'Le type du catway doit être long ou short.');
  }

  return Catway.create({
    catwayNumber: Number(input.catwayNumber),
    catwayType: input.catwayType,
    catwayState: typeof input.catwayState === 'string' ? input.catwayState : '',
  });
}

export async function updateCatwayState(
  catwayNumber: number,
  catwayState: unknown,
): Promise<CatwayEntity> {
  const catway = await findCatway(catwayNumber);
  catway.catwayState = typeof catwayState === 'string' ? catwayState : '';
  await catway.save();
  return catway;
}

export async function deleteCatway(
  catwayNumber: number,
): Promise<{ catway: CatwayEntity; deleted: boolean }> {
  return withCatwayLock(catwayNumber, async () => {
    const catway = await findCatway(catwayNumber);
    if (await Reservation.exists({ catwayNumber })) {
      return { catway, deleted: false };
    }

    await catway.deleteOne();
    return { catway, deleted: true };
  });
}
