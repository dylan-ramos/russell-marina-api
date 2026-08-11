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

  test('refuse toutes les familles de routes privées sans session', async () => {
    const protectedRequests = [
      request(application).get('/dashboard'),
      request(application).get('/catways'),
      request(application).get('/catways/new'),
      request(application).get('/catways/42'),
      request(application).post('/catways'),
      request(application).put('/catways/42'),
      request(application).delete('/catways/42'),
      request(application).get('/reservations'),
      request(application).get('/reservations/new'),
      request(application).post('/reservations'),
      request(application).get('/catways/42/reservations'),
      request(application).post('/catways/42/reservations'),
      request(application).get('/users'),
      request(application).get('/users/new'),
      request(application).post('/users'),
      request(application).put('/users/user%40example.test'),
      request(application).delete('/users/user%40example.test'),
    ];

    for (const protectedRequest of protectedRequests) {
      const response = await protectedRequest.set('Accept', 'application/json').expect(401);
      assert.equal(response.body.error.status, 401);
    }
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

    const reservedCatwayDeletion = await agent.delete('/catways/42').set(jsonHeaders).expect(409);
    assert.equal(reservedCatwayDeletion.body.error.status, 409);

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

    const ownAccountDeletion = await agent
      .delete('/users/admin%40example.test')
      .set(jsonHeaders)
      .expect(409);
    assert.equal(ownAccountDeletion.body.error.status, 409);

    await agent.delete(`/catways/42/reservations/${reservationId}`).set(jsonHeaders).expect(204);
    await agent.delete('/catways/42').set(jsonHeaders).expect(204);
    await agent.delete('/users/adjoint%40example.test').set(jsonHeaders).expect(204);

    assert.equal(await User.countDocuments(), 1);
  });

  test('affiche les formulaires HTML et leurs erreurs de validation', async () => {
    const { agent, csrfToken } = await authenticatedAgent();

    await agent
      .get('/catways/new')
      .set('Accept', 'text/html')
      .expect(200)
      .expect('Content-Type', /html/);
    await agent
      .get('/reservations/new')
      .set('Accept', 'text/html')
      .expect(200)
      .expect('Content-Type', /html/);
    await agent
      .get('/users/new')
      .set('Accept', 'text/html')
      .expect(200)
      .expect('Content-Type', /html/);

    await agent
      .post('/catways')
      .set('Accept', 'text/html')
      .set('X-CSRF-Token', csrfToken)
      .type('form')
      .send({ catwayNumber: 0, catwayType: 'invalid', catwayState: '' })
      .expect(422)
      .expect('Content-Type', /html/);

    await agent
      .post('/users')
      .set('Accept', 'text/html')
      .set('X-CSRF-Token', csrfToken)
      .type('form')
      .send({ username: 'x', email: 'invalid', password: 'court' })
      .expect(422)
      .expect('Content-Type', /html/);

    await agent
      .post('/catways')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' })
      .expect(201);
    await agent
      .post('/catways/42/reservations')
      .set('Accept', 'text/html')
      .set('X-CSRF-Token', csrfToken)
      .type('form')
      .send({
        clientName: 'A',
        boatName: 'B',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
      })
      .expect(422)
      .expect('Content-Type', /html/);
  });

  test('renvoie 422 plutôt que 500 pour une réservation JSON invalide', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const headers = { Accept: 'application/json', 'X-CSRF-Token': csrfToken };

    await agent
      .post('/catways')
      .set(headers)
      .send({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' })
      .expect(201);

    const response = await agent
      .post('/catways/42/reservations')
      .set(headers)
      .send({
        clientName: 'A',
        boatName: 'B',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
      })
      .expect(422);

    assert.equal(response.body.error.status, 422);
    assert.ok(Array.isArray(response.body.error.messages));
    assert.match(response.body.error.messages.join(' '), /au moins 2 caractères/);
  });

  test('normalise les validations et conflits JSON des autres ressources', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const headers = { Accept: 'application/json', 'X-CSRF-Token': csrfToken };

    const invalidCatway = await agent
      .post('/catways')
      .set(headers)
      .send({ catwayNumber: 0, catwayType: 'invalid', catwayState: '' })
      .expect(422);
    assert.equal(invalidCatway.body.error.status, 422);
    assert.ok(Array.isArray(invalidCatway.body.error.messages));

    await agent
      .post('/catways')
      .set(headers)
      .send({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' })
      .expect(201);
    const duplicateCatway = await agent
      .post('/catways')
      .set(headers)
      .send({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' })
      .expect(409);
    assert.deepEqual(duplicateCatway.body.error, {
      status: 409,
      messages: ['Ce numéro de catway existe déjà.'],
    });

    const invalidUser = await agent
      .post('/users')
      .set(headers)
      .send({ username: 'x', email: 'invalid', password: 'court' })
      .expect(422);
    assert.equal(invalidUser.body.error.status, 422);
    assert.ok(Array.isArray(invalidUser.body.error.messages));

    const malformedJson = await agent
      .post('/users')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send('{"username":')
      .expect(400);
    assert.equal(malformedJson.body.error.status, 400);
  });
  test.todo('empêche deux réservations concurrentes qui se chevauchent');
  test.todo('conserve une réservation courante pendant toute sa date de fin');
});
