import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import express from 'express';
import session from 'express-session';
import request from 'supertest';

import { provideCsrfToken, verifyCsrfToken } from '../src/middlewares/csrf.js';

function csrfTestApplication() {
  const application = express();
  application.use(express.json());
  application.use(
    session({
      secret: 'test-session-secret-with-at-least-32-characters',
      resave: false,
      saveUninitialized: true,
    }),
  );
  application.get('/token', provideCsrfToken, (_request, response) => {
    response.status(200).json({ token: response.locals.csrfToken });
  });
  application.post('/protected', verifyCsrfToken, (_request, response) => {
    response.sendStatus(204);
  });
  application.use(((error, _request, response, _next) => {
    response.status(typeof error.status === 'number' ? error.status : 500).json({
      message: error.message,
    });
  }) as express.ErrorRequestHandler);
  return application;
}

describe('protection CSRF', () => {
  test('refuse une mutation sans jeton', async () => {
    const agent = request.agent(csrfTestApplication());
    await agent.get('/token').expect(200);
    await agent.post('/protected').send({}).expect(403);
  });

  test('accepte le jeton associé à la session', async () => {
    const agent = request.agent(csrfTestApplication());
    const tokenResponse = await agent.get('/token').expect(200);
    assert.equal(typeof tokenResponse.body.token, 'string');

    await agent
      .post('/protected')
      .set('X-CSRF-Token', tokenResponse.body.token as string)
      .send({})
      .expect(204);
  });
});
