import mongoose from 'mongoose';

const TEST_DATABASE_PATTERN = /(?:^|[_-])test(?:[_-]|$)/i;

function requiredTestMongoUri(): string {
  const value = process.env.TEST_MONGO_URI?.trim();

  if (!value) {
    throw new Error(
      'TEST_MONGO_URI est obligatoire. Lancez les tests dans Docker avec `make test`.',
    );
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(new URL(value).pathname.slice(1));
  } catch {
    throw new Error("TEST_MONGO_URI n'est pas une URI MongoDB valide.");
  }

  if (!databaseName || !TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      `La base de tests doit contenir le mot "test" dans son nom (reçu : ${databaseName || 'aucun'}).`,
    );
  }

  return value;
}

export async function connectTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    throw new Error('Une connexion MongoDB existe déjà avant le démarrage des tests.');
  }

  const mongoUri = requiredTestMongoUri();
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = mongoUri;
  process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
}

export async function resetTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  }
}

export async function disconnectTestDatabase(): Promise<void> {
  try {
    await resetTestDatabase();
  } finally {
    await mongoose.disconnect();
  }
}
