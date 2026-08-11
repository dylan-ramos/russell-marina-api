import createError from 'http-errors';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function createToken(): string {
  return randomBytes(32).toString('hex');
}

function tokensMatch(expectedToken: string, submittedToken: string): boolean {
  const expected = Buffer.from(expectedToken);
  const submitted = Buffer.from(submittedToken);

  return expected.length === submitted.length && timingSafeEqual(expected, submitted);
}

export const provideCsrfToken: RequestHandler = (request, response, next) => {
  request.session.csrfToken ??= createToken();
  response.locals.csrfToken = request.session.csrfToken;
  next();
};

export const verifyCsrfToken: RequestHandler = (request, _response, next) => {
  const expectedToken = request.session.csrfToken;
  const submittedToken = typeof request.body._csrf === 'string' ? request.body._csrf : '';

  if (!expectedToken || !tokensMatch(expectedToken, submittedToken)) {
    next(createError(403, 'Le formulaire a expiré. Rechargez la page puis réessayez.'));
    return;
  }

  next();
};

export function rotateCsrfToken(request: Express.Request): string {
  const token = createToken();
  request.session.csrfToken = token;
  return token;
}
