import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import type { Express } from 'express';
import request, { type Agent } from 'supertest';

import { User } from '../src/models/user.js';
import { createUser } from '../src/services/users.js';
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
} from './helpers/database.js';

let application: Express;

before(async () => {
  await connectTestDatabase();
  application = (await import('../src/app.js')).default;
});

beforeEach(async () => {
  await resetTestDatabase();
  await createUser({
    username: 'administrateur',
    email: 'admin@example.test',
    password: 'mot-de-passe-test',
  });
});

after(disconnectTestDatabase);

async function authenticatedAgent(): Promise<{ agent: Agent; csrfToken: string }> {
  const agent = request.agent(application);
  const homeResponse = await agent.get('/').set('Accept', 'text/html').expect(200);
  const loginToken = homeResponse.headers['x-csrf-token'];
  if (typeof loginToken !== 'string') {
    throw new Error('Le jeton CSRF de connexion est absent.');
  }

  await agent
    .post('/login')
    .set('Accept', 'text/html')
    .set('X-CSRF-Token', loginToken)
    .send({ email: 'admin@example.test', password: 'mot-de-passe-test' })
    .expect(302)
    .expect('Location', '/dashboard');

  const catwaysResponse = await agent.get('/catways').set('Accept', 'application/json').expect(200);
  const csrfToken = catwaysResponse.headers['x-csrf-token'];
  if (typeof csrfToken !== 'string') {
    throw new Error('Le jeton CSRF authentifié est absent.');
  }

  return { agent, csrfToken };
}

describe('API HTTP', () => {
  test('expose la santé et OpenAPI sans authentification', async () => {
    await request(application)
      .get('/health')
      .set('Accept', 'application/json')
      .expect(200, { status: 'ok' });

    const documentation = await request(application)
      .get('/openapi.json')
      .set('Accept', 'application/json')
      .expect(200);
    assert.equal(documentation.body.openapi, '3.1.0');
  });

  test('refuse une route privée sans session', async () => {
    const response = await request(application)
      .get('/catways')
      .set('Accept', 'application/json')
      .expect(401);
    assert.equal(response.body.error.status, 401);
  });

  test('refuse un identifiant incorrect puis ouvre une session valide', async () => {
    const agent = request.agent(application);
    const homeResponse = await agent.get('/').expect(200);
    const token = homeResponse.headers['x-csrf-token'];
    if (typeof token !== 'string') {
      throw new Error('Le jeton CSRF de connexion est absent.');
    }

    await agent
      .post('/login')
      .set('X-CSRF-Token', token)
      .send({ email: 'admin@example.test', password: 'incorrect-password' })
      .expect(401);

    const authenticated = await authenticatedAgent();
    await authenticated.agent.get('/dashboard').expect(200);
  });

  test('exécute les CRUD JSON avec session et jeton CSRF', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const jsonHeaders = { Accept: 'application/json', 'X-CSRF-Token': csrfToken };

    await agent
      .post('/catways')
      .set(jsonHeaders)
      .send({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' })
      .expect(201);

    await agent
      .put('/catways/42')
      .set(jsonHeaders)
      .send({ catwayState: 'Maintenance préventive' })
      .expect(200);

    const reservationResponse = await agent
      .post('/catways/42/reservations')
      .set(jsonHeaders)
      .send({
        clientName: 'Ada Lovelace',
        boatName: 'Analytical Engine',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
      })
      .expect(201);
    const reservationId = reservationResponse.body._id as string;
    assert.equal(typeof reservationId, 'string');

    await agent
      .put(`/catways/42/reservations/${reservationId}`)
      .set(jsonHeaders)
      .send({
        clientName: 'Ada Lovelace',
        boatName: 'Difference Engine',
        startDate: '2026-10-11',
        endDate: '2026-10-13',
      })
      .expect(200);

    await agent
      .post('/users')
      .set(jsonHeaders)
      .send({
        username: 'second-capitaine',
        email: 'second@example.test',
        password: 'second-mot-de-passe',
      })
      .expect(201);

    await agent
      .put('/users/second%40example.test')
      .set(jsonHeaders)
      .send({
        username: 'capitaine-adjoint',
        email: 'adjoint@example.test',
        password: '',
      })
      .expect(200);

    await agent.delete(`/catways/42/reservations/${reservationId}`).set(jsonHeaders).expect(204);
    await agent.delete('/catways/42').set(jsonHeaders).expect(204);
    await agent.delete('/users/adjoint%40example.test').set(jsonHeaders).expect(204);

    assert.equal(await User.countDocuments(), 1);
  });

  test.todo('renvoie 422 plutôt que 500 pour une réservation JSON invalide');
  test.todo('empêche deux réservations concurrentes qui se chevauchent');
  test.todo('conserve une réservation courante pendant toute sa date de fin');
});
