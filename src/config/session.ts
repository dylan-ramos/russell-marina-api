import MongoStore from 'connect-mongo';
import session, { type SessionOptions } from 'express-session';

export const SESSION_COOKIE_NAME = 'russell.sid';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1_000;

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} est obligatoire.`);
  }

  return value;
}

export function createSessionMiddleware(): ReturnType<typeof session> {
  const mongoUri = requiredEnvironmentVariable('MONGO_URI');
  const secret = requiredEnvironmentVariable('SESSION_SECRET');

  if (secret.length < 32) {
    throw new Error('SESSION_SECRET doit contenir au moins 32 caractères.');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const options: SessionOptions = {
    name: SESSION_COOKIE_NAME,
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: SESSION_DURATION_MS,
      path: '/',
    },
  };

  if (!isTest) {
    options.store = MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: 'sessions',
      ttl: SESSION_DURATION_MS / 1_000,
      autoRemove: 'native',
    });
  }

  return session(options);
}
