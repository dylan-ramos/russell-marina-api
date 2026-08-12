function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} est obligatoire.`);
  }

  return value;
}

export function mongoConnectionUri(): string {
  const explicitTestUri =
    process.env.NODE_ENV === 'test' ? process.env.MONGO_URI?.trim() : undefined;
  if (explicitTestUri) {
    return explicitTestUri;
  }

  const database = requiredEnvironmentVariable('MONGO_DATABASE');
  const username = requiredEnvironmentVariable('MONGO_APP_USERNAME');
  const password = requiredEnvironmentVariable('MONGO_APP_PASSWORD');
  const host = process.env.MONGO_HOST?.trim() || 'mongodb';
  const port = process.env.MONGO_PORT?.trim() || '27017';

  return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?authSource=${encodeURIComponent(database)}`;
}
