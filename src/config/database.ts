import mongoose from 'mongoose';

import { mongoConnectionUri } from './mongodb.js';

let connectionPromise: Promise<typeof mongoose> | undefined;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  connectionPromise ??= mongoose.connect(mongoConnectionUri(), {
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    const connection = await connectionPromise;
    console.info(`MongoDB connecté à la base ${connection.connection.name}.`);
    return connection;
  } catch (error) {
    connectionPromise = undefined;
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  connectionPromise = undefined;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.info('Connexion MongoDB fermée.');
  }
}
