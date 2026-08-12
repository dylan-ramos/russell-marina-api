import type { Request } from 'express';

export function notificationFromQuery(
  request: Request,
  notifications: Readonly<Record<string, string>>,
): string | undefined {
  const key = typeof request.query.success === 'string' ? request.query.success : '';
  return notifications[key];
}
