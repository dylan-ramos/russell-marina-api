import createError from 'http-errors';

export function parseCatwayNumber(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw createError(400, 'Le numéro du catway doit être un entier positif.');
  }

  const catwayNumber = Number(value);
  if (!Number.isSafeInteger(catwayNumber) || catwayNumber < 1) {
    throw createError(400, 'Le numéro du catway doit être un entier positif.');
  }

  return catwayNumber;
}
