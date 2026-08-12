import createError from 'http-errors';
import { isValidObjectId, type HydratedDocument } from 'mongoose';

import { Catway } from '../models/catway.js';
import { Reservation, type ReservationDocument } from '../models/reservation.js';
import { parseCalendarDate } from '../utils/calendar-date.js';
import { requiredText } from '../utils/validation.js';
import { withCatwayLock } from './catway-locks.js';

export interface ReservationInput {
  clientName: unknown;
  boatName: unknown;
  startDate: unknown;
  endDate: unknown;
}

type ReservationEntity = HydratedDocument<ReservationDocument>;

function normalizeInput(
  input: ReservationInput,
): Omit<ReservationDocument, 'catwayNumber' | 'createdAt' | 'updatedAt'> {
  const startDate = parseCalendarDate(input.startDate, 'La date de début');
  const endDate = parseCalendarDate(input.endDate, 'La date de fin');

  if (endDate < startDate) {
    throw createError(422, 'La date de fin doit être postérieure à la date de début.');
  }

  return {
    clientName: requiredText(input.clientName, 'Le nom du client'),
    boatName: requiredText(input.boatName, 'Le nom du bateau'),
    startDate,
    endDate,
  };
}

async function assertCatwayExists(catwayNumber: number): Promise<void> {
  if (!(await Catway.exists({ catwayNumber }))) {
    throw createError(404, `Le catway ${catwayNumber} n'existe pas.`);
  }
}

async function assertNoOverlap(
  catwayNumber: number,
  startDate: Date,
  endDate: Date,
  excludedReservationId?: string,
): Promise<void> {
  const overlappingReservation = await Reservation.exists({
    catwayNumber,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    ...(excludedReservationId ? { _id: { $ne: excludedReservationId } } : {}),
  });

  if (overlappingReservation) {
    throw createError(409, 'Ce catway est déjà réservé sur cette période.');
  }
}

export async function findAllReservations(): Promise<ReservationEntity[]> {
  return Reservation.find().sort({ startDate: 1, catwayNumber: 1 });
}

export async function findReservableCatways() {
  return Catway.find().sort({ catwayNumber: 1 });
}

export async function findReservationsByCatway(catwayNumber: number): Promise<ReservationEntity[]> {
  await assertCatwayExists(catwayNumber);
  return Reservation.find({ catwayNumber }).sort({ startDate: 1 });
}

export async function findReservation(
  catwayNumber: number,
  reservationId: string,
): Promise<ReservationEntity> {
  if (!isValidObjectId(reservationId)) {
    throw createError(400, "L'identifiant de la réservation n'est pas valide.");
  }

  await assertCatwayExists(catwayNumber);
  const reservation = await Reservation.findOne({ _id: reservationId, catwayNumber });

  if (!reservation) {
    throw createError(404, "La réservation n'existe pas pour ce catway.");
  }

  return reservation;
}

export async function createReservation(
  catwayNumber: number,
  input: ReservationInput,
): Promise<ReservationEntity> {
  const normalizedInput = normalizeInput(input);

  return withCatwayLock(catwayNumber, async () => {
    await assertCatwayExists(catwayNumber);
    await assertNoOverlap(catwayNumber, normalizedInput.startDate, normalizedInput.endDate);
    return Reservation.create({ ...normalizedInput, catwayNumber });
  });
}

export async function updateReservation(
  catwayNumber: number,
  reservationId: string,
  input: ReservationInput,
): Promise<ReservationEntity> {
  const normalizedInput = normalizeInput(input);

  return withCatwayLock(catwayNumber, async () => {
    const reservation = await findReservation(catwayNumber, reservationId);
    await assertNoOverlap(
      catwayNumber,
      normalizedInput.startDate,
      normalizedInput.endDate,
      reservationId,
    );

    reservation.clientName = normalizedInput.clientName;
    reservation.boatName = normalizedInput.boatName;
    reservation.startDate = normalizedInput.startDate;
    reservation.endDate = normalizedInput.endDate;
    await reservation.save();
    return reservation;
  });
}

export async function deleteReservation(
  catwayNumber: number,
  reservationId: string,
): Promise<void> {
  const reservation = await findReservation(catwayNumber, reservationId);
  await reservation.deleteOne();
}
