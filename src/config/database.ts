import mongoose from 'mongoose';

let connectionPromise: Promise<typeof mongoose> | undefined;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('La variable MONGO_URI est obligatoire.');
  }

  connectionPromise ??= mongoose.connect(mongoUri, {
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
