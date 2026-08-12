import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import type { Express } from 'express';
import mongoose from 'mongoose';
import request, { type Agent } from 'supertest';

import { Catway } from '../src/models/catway.js';
import { Reservation } from '../src/models/reservation.js';
import { User } from '../src/models/user.js';
import { createUser } from '../src/services/users.js';
import { calendarDateInTimeZone } from '../src/utils/calendar-date.js';
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
      .expect(200, { status: 'ok', database: 'connected' });

    const documentation = await request(application)
      .get('/openapi.json')
      .set('Accept', 'application/json')
      .expect(200);
    assert.equal(documentation.body.openapi, '3.1.0');

    const swagger = await request(application).get('/api-docs/').expect(200);
    const contentSecurityPolicy = swagger.headers['content-security-policy'];
    if (typeof contentSecurityPolicy !== 'string') {
      throw new Error("L'en-tête CSP de Swagger est absent.");
    }
    assert.match(contentSecurityPolicy, /default-src 'self'/);
    assert.doesNotMatch(contentSecurityPolicy, /default-src \*/);
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

  test('déconnecte la session avec un POST protégé par CSRF', async () => {
    const { agent, csrfToken } = await authenticatedAgent();

    await agent.post('/logout').set('Accept', 'text/html').send({}).expect(403);
    await agent
      .post('/logout')
      .set('Accept', 'text/html')
      .set('X-CSRF-Token', csrfToken)
      .send({})
      .expect(302)
      .expect('Location', '/');
    await agent.get('/dashboard').set('Accept', 'application/json').expect(401);
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
  test('empêche deux réservations concurrentes qui se chevauchent', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const headers = { Accept: 'application/json', 'X-CSRF-Token': csrfToken };
    await agent
      .post('/catways')
      .set(headers)
      .send({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' })
      .expect(201);

    const [firstResponse, secondResponse] = await Promise.all([
      agent.post('/catways/42/reservations').set(headers).send({
        clientName: 'Premier client',
        boatName: 'Premier bateau',
        startDate: '2026-10-10',
        endDate: '2026-10-15',
      }),
      agent.post('/catways/42/reservations').set(headers).send({
        clientName: 'Second client',
        boatName: 'Second bateau',
        startDate: '2026-10-12',
        endDate: '2026-10-14',
      }),
    ]);

    assert.deepEqual([firstResponse.status, secondResponse.status].sort(), [201, 409]);
    assert.equal(await Reservation.countDocuments({ catwayNumber: 42 }), 1);
  });

  test('sérialise la suppression d’un catway et la création d’une réservation', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const headers = { Accept: 'application/json', 'X-CSRF-Token': csrfToken };
    await agent
      .post('/catways')
      .set(headers)
      .send({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' })
      .expect(201);

    const [deletionResponse, reservationResponse] = await Promise.all([
      agent.delete('/catways/42').set(headers),
      agent.post('/catways/42/reservations').set(headers).send({
        clientName: 'Client concurrent',
        boatName: 'Bateau concurrent',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
      }),
    ]);

    const statusPair = [deletionResponse.status, reservationResponse.status].sort().join(',');
    assert.ok(statusPair === '201,409' || statusPair === '204,404');

    const [catwayExists, reservationExists] = await Promise.all([
      Catway.exists({ catwayNumber: 42 }),
      Reservation.exists({ catwayNumber: 42 }),
    ]);
    assert.equal(Boolean(catwayExists), Boolean(reservationExists));
  });
  test('conserve une réservation courante pendant toute sa date de fin', async () => {
    const today = calendarDateInTimeZone(new Date(), 'Europe/Paris');
    await Catway.create({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' });
    await Reservation.create({
      catwayNumber: 42,
      clientName: 'Client du dernier jour',
      boatName: 'Calendrier',
      startDate: new Date(`${today}T00:00:00.000Z`),
      endDate: new Date(`${today}T00:00:00.000Z`),
    });

    const { agent } = await authenticatedAgent();
    await agent
      .get('/dashboard')
      .set('Accept', 'text/html')
      .expect(200)
      .expect(/Client du dernier jour/);
  });

  test('signale MongoDB indisponible avec HTTP 503', async () => {
    await mongoose.disconnect();
    await request(application)
      .get('/health')
      .set('Accept', 'application/json')
      .expect(503, { status: 'unavailable', database: 'disconnected' });
  });
});
