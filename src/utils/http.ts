import type { Request } from 'express';
import { Error as MongooseError } from 'mongoose';

export interface HttpErrorDetails {
  status: number;
  messages: string[];
}

interface ErrorDetailsOptions {
  duplicateMessage?: string;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function explicitHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }

  const status = Number(error.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
}

function messageFromError(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined;
}

export function requestWantsHtml(request: Request): boolean {
  return request.accepts(['html', 'json']) === 'html';
}

export function httpErrorDetails(
  error: unknown,
  options: ErrorDetailsOptions = {},
): HttpErrorDetails | undefined {
  if (error instanceof MongooseError.ValidationError) {
    return {
      status: 422,
      messages: Object.values(error.errors).map(
        (validationError) => validationError.message || 'La valeur fournie est invalide.',
      ),
    };
  }

  if (isDuplicateKeyError(error) && options.duplicateMessage) {
    return { status: 409, messages: [options.duplicateMessage] };
  }

  const status = explicitHttpStatus(error);
  if (status) {
    return {
      status,
      messages: [messageFromError(error) ?? 'La requête ne peut pas être traitée.'],
    };
  }

  return undefined;
}
