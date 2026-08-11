import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/user.js';

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} est obligatoire pour modifier l'administrateur.`);
  }

  return value;
}

async function resetAdministrator(): Promise<void> {
  await connectDatabase();

  const users = await User.find().select('+password');

  if (users.length !== 1) {
    throw new Error(
      `Opération annulée : la base doit contenir exactement un utilisateur, ${users.length} trouvé(s).`,
    );
  }

  const administrator = users[0];

  if (!administrator) {
    throw new Error('Administrateur introuvable.');
  }

  administrator.username = requiredEnvironmentVariable('SEED_ADMIN_USERNAME');
  administrator.email = requiredEnvironmentVariable('SEED_ADMIN_EMAIL').toLowerCase();
  administrator.password = requiredEnvironmentVariable('SEED_ADMIN_PASSWORD');

  await administrator.save();
  console.info('Compte administrateur mis à jour.');
}

try {
  await resetAdministrator();
} catch (error) {
  console.error(
    "La mise à jour de l'administrateur a échoué :",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
