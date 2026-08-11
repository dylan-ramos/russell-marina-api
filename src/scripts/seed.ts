import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Catway, type CatwayDocument } from '../models/catway.js';
import { Reservation, type ReservationDocument } from '../models/reservation.js';
import { User } from '../models/user.js';

type SeedCatway = Pick<CatwayDocument, 'catwayNumber' | 'catwayType' | 'catwayState'>;
type SeedReservation = Omit<
  ReservationDocument,
  'startDate' | 'endDate' | 'createdAt' | 'updatedAt'
> & {
  startDate: string;
  endDate: string;
};

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

async function readSeedFile<T>(filename: string): Promise<T> {
  const content = await fs.readFile(path.join(projectRoot, 'data', filename), 'utf8');
  return JSON.parse(content) as T;
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} est obligatoire pour initialiser la base.`);
  }

  return value;
}

async function seedCatways(catways: SeedCatway[]): Promise<number> {
  await Promise.all(catways.map((catway) => new Catway(catway).validate()));

  const result = await Catway.bulkWrite(
    catways.map((catway) => ({
      updateOne: {
        filter: { catwayNumber: catway.catwayNumber },
        update: { $setOnInsert: catway },
        upsert: true,
      },
    })),
  );

  return result.upsertedCount;
}

async function seedReservations(reservations: SeedReservation[]): Promise<number> {
  const normalizedReservations = reservations.map((reservation) => ({
    ...reservation,
    startDate: new Date(reservation.startDate),
    endDate: new Date(reservation.endDate),
  }));

  await Promise.all(
    normalizedReservations.map((reservation) => new Reservation(reservation).validate()),
  );

  const result = await Reservation.bulkWrite(
    normalizedReservations.map((reservation) => ({
      updateOne: {
        filter: {
          catwayNumber: reservation.catwayNumber,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
        },
        update: { $setOnInsert: reservation },
        upsert: true,
      },
    })),
  );

  return result.upsertedCount;
}

async function seedAdministrator(): Promise<boolean> {
  const username = requiredEnvironmentVariable('SEED_ADMIN_USERNAME');
  const email = requiredEnvironmentVariable('SEED_ADMIN_EMAIL').toLowerCase();
  const password = requiredEnvironmentVariable('SEED_ADMIN_PASSWORD');
  const existingAdministrator = await User.exists({ email });

  if (existingAdministrator) {
    return false;
  }

  await User.create({ username, email, password });
  return true;
}

async function seed(): Promise<void> {
  await connectDatabase();

  const [catways, reservations] = await Promise.all([
    readSeedFile<SeedCatway[]>('catways.json'),
    readSeedFile<SeedReservation[]>('reservations.json'),
  ]);

  await Promise.all([Catway.syncIndexes(), Reservation.syncIndexes(), User.syncIndexes()]);

  const insertedCatways = await seedCatways(catways);
  const insertedReservations = await seedReservations(reservations);
  const administratorCreated = await seedAdministrator();

  console.info(
    [
      'Initialisation terminée :',
      `${insertedCatways} catway(s) ajouté(s),`,
      `${insertedReservations} réservation(s) ajoutée(s),`,
      administratorCreated ? 'administrateur créé.' : 'administrateur déjà présent.',
    ].join(' '),
  );
}

try {
  await seed();
} catch (error) {
  console.error(
    "L'initialisation de la base a échoué :",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
