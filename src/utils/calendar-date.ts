import createError from 'http-errors';

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCalendarDate(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string' || !value) {
    throw createError(422, `${fieldName} est obligatoire.`);
  }

  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw createError(422, `${fieldName} doit respecter le format AAAA-MM-JJ.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createError(422, `${fieldName} n'est pas une date valide.`);
  }

  return date;
}

export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function encodedCalendarDayBounds(
  date: Date,
  timeZone: string,
): { start: Date; next: Date } {
  const start = parseCalendarDate(calendarDateInTimeZone(date, timeZone), 'La date');
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);

  return { start, next };
}
