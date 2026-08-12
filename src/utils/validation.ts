import createError from 'http-errors';

export function requiredText(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError(422, `${fieldName} est obligatoire.`);
  }

  return value.trim();
}
