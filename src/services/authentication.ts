import bcrypt from 'bcrypt';

import { User } from '../models/user.js';

const DUMMY_PASSWORD_HASH = '$2b$12$T4dJrrKAA06NRdr2gxI88OAb9L59NJdxLhybPZ0oAQant4/SOAUoe';

export async function authenticateUser(email: string, password: string) {
  const user = await User.findOne({ email }).select('+password');
  const passwordValid = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

  return user && passwordValid ? user : undefined;
}
