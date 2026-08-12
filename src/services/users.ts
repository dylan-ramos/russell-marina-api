import createError from 'http-errors';
import { isValidObjectId, type HydratedDocument } from 'mongoose';

import { User, type UserDocument } from '../models/user.js';
import { requiredText } from '../utils/validation.js';
import { withDistributedLock } from './distributed-locks.js';

export interface UserInput {
  username: unknown;
  email: unknown;
  password: unknown;
}

type UserEntity = HydratedDocument<UserDocument>;

function normalizeEmail(value: unknown): string {
  return requiredText(value, "L'adresse email").toLowerCase();
}

function normalizedPassword(value: unknown, required: boolean): string | undefined {
  if (!required && (value === undefined || value === '')) {
    return undefined;
  }

  const password = requiredText(value, 'Le mot de passe');

  if (password.length < 12) {
    throw createError(422, 'Le mot de passe doit contenir au moins 12 caractères.');
  }

  return password;
}

function duplicateMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) {
    return undefined;
  }

  const keyPattern = 'keyPattern' in error ? error.keyPattern : undefined;
  return typeof keyPattern === 'object' && keyPattern !== null && 'username' in keyPattern
    ? "Ce nom d'utilisateur existe déjà."
    : 'Cette adresse email existe déjà.';
}

async function saveWithDuplicateHandling(user: UserEntity): Promise<UserEntity> {
  try {
    await user.save();
    return user;
  } catch (error) {
    const message = duplicateMessage(error);

    if (message) {
      throw createError(409, message);
    }

    throw error;
  }
}

export async function findAllUsers(): Promise<UserEntity[]> {
  return User.find().sort({ username: 1 });
}

export async function findUserByEmail(email: string): Promise<UserEntity> {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw createError(404, `L'utilisateur ${normalizedEmail} n'existe pas.`);
  }

  return user;
}

export async function createUser(input: UserInput): Promise<UserEntity> {
  const user = new User({
    username: requiredText(input.username, "Le nom d'utilisateur"),
    email: normalizeEmail(input.email),
    password: normalizedPassword(input.password, true),
  });

  return saveWithDuplicateHandling(user);
}

export async function updateUser(currentEmail: string, input: UserInput): Promise<UserEntity> {
  const user = await findUserByEmail(currentEmail);
  user.username = requiredText(input.username, "Le nom d'utilisateur");
  user.email = normalizeEmail(input.email);

  const password = normalizedPassword(input.password, false);
  if (password) {
    user.password = password;
  }

  return saveWithDuplicateHandling(user);
}

export async function deleteUser(email: string, currentUserId: string): Promise<void> {
  return withDistributedLock('users:deletion', async () => {
    const user = await findUserByEmail(email);

    if (isValidObjectId(currentUserId) && user._id.equals(currentUserId)) {
      throw createError(409, 'Vous ne pouvez pas supprimer votre propre compte.');
    }

    if ((await User.countDocuments()) <= 1) {
      throw createError(409, 'Le dernier compte utilisateur ne peut pas être supprimé.');
    }

    await user.deleteOne();
  });
}
