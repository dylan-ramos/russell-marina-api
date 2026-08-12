import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import express from 'express';
import session from 'express-session';
import request from 'supertest';

import { mongoConnectionUri } from '../src/config/mongodb.js';
import { provideCsrfToken, verifyCsrfToken } from '../src/middlewares/csrf.js';
import { loginRateLimit } from '../src/middlewares/login-rate-limit.js';

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

describe('limitation des connexions', () => {
  test('ignore les succès puis bloque la onzième tentative en échec', async () => {
    const application = express();
    application.use(express.json());
    application.post('/login', loginRateLimit, (incomingRequest, response) => {
      response.sendStatus(incomingRequest.body.success === true ? 204 : 401);
    });

    await request(application).post('/login').send({ success: true }).expect(204);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await request(application).post('/login').send({ success: false }).expect(401);
    }

    const blockedResponse = await request(application)
      .post('/login')
      .send({ success: false })
      .expect(429);
    assert.match(blockedResponse.text, /Trop de tentatives de connexion/);
    assert.ok(blockedResponse.headers['ratelimit']);
  });
});

describe('connexion MongoDB applicative', () => {
  test('encode les identifiants et ignore une URI root hors des tests', () => {
    const previousEnvironment = { ...process.env };

    try {
      process.env.NODE_ENV = 'production';
      process.env.MONGO_URI = 'mongodb://root:secret@mongodb/admin';
      process.env.MONGO_DATABASE = 'russell_marina';
      process.env.MONGO_APP_USERNAME = 'russell@app';
      process.env.MONGO_APP_PASSWORD = 'mot:de/passe@fort';
      process.env.MONGO_HOST = 'mongodb';

      assert.equal(
        mongoConnectionUri(),
        'mongodb://russell%40app:mot%3Ade%2Fpasse%40fort@mongodb:27017/russell_marina?authSource=russell_marina',
      );
    } finally {
      process.env = previousEnvironment;
    }
  });
});
