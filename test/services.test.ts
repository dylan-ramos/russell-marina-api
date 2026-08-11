import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import { Catway } from '../src/models/catway.js';
import { Reservation } from '../src/models/reservation.js';
import { User } from '../src/models/user.js';
import {
  createReservation,
  deleteReservation,
  findReservation,
  updateReservation,
} from '../src/services/reservations.js';
import { createUser, deleteUser, findUserByEmail, updateUser } from '../src/services/users.js';
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
} from './helpers/database.js';

function errorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status)
    : undefined;
}

before(connectTestDatabase);
beforeEach(resetTestDatabase);
after(disconnectTestDatabase);

describe('service des réservations', () => {
  beforeEach(async () => {
    await Catway.create({ catwayNumber: 42, catwayType: 'long', catwayState: 'Disponible' });
  });

  test('crée, retrouve, modifie puis supprime une réservation', async () => {
    const reservation = await createReservation(42, {
      clientName: 'Ada Lovelace',
      boatName: 'Analytical Engine',
      startDate: '2026-09-10',
      endDate: '2026-09-12',
    });

    const found = await findReservation(42, reservation.id);
    assert.equal(found.clientName, 'Ada Lovelace');

    const updated = await updateReservation(42, reservation.id, {
      clientName: 'Ada Lovelace',
      boatName: 'Difference Engine',
      startDate: '2026-09-11',
      endDate: '2026-09-13',
    });
    assert.equal(updated.boatName, 'Difference Engine');

    await deleteReservation(42, reservation.id);
    assert.equal(await Reservation.countDocuments(), 0);
  });

  test('refuse une réservation sur un catway inexistant', async () => {
    await assert.rejects(
      createReservation(404, {
        clientName: 'Grace Hopper',
        boatName: 'Compiler',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
      }),
      (error) => errorStatus(error) === 404,
    );
  });

  test('refuse une période qui chevauche une réservation existante', async () => {
    await createReservation(42, {
      clientName: 'Premier client',
      boatName: 'Premier bateau',
      startDate: '2026-10-10',
      endDate: '2026-10-15',
    });

    await assert.rejects(
      createReservation(42, {
        clientName: 'Second client',
        boatName: 'Second bateau',
        startDate: '2026-10-12',
        endDate: '2026-10-14',
      }),
      (error) => errorStatus(error) === 409,
    );
  });

  test('refuse une date de fin antérieure à la date de début', async () => {
    await assert.rejects(
      createReservation(42, {
        clientName: 'Client valide',
        boatName: 'Bateau valide',
        startDate: '2026-11-10',
        endDate: '2026-11-09',
      }),
      (error) => errorStatus(error) === 422,
    );
  });
});

describe('service des utilisateurs', () => {
  test('hachage du mot de passe et cycle CRUD', async () => {
    const user = await createUser({
      username: 'capitaine',
      email: 'capitaine@example.test',
      password: 'mot-de-passe-test',
    });

    const passwordUser = await User.findById(user.id).select('+password');
    assert.ok(passwordUser);
    assert.notEqual(passwordUser.password, 'mot-de-passe-test');
    assert.equal(await passwordUser.comparePassword('mot-de-passe-test'), true);

    const updated = await updateUser('capitaine@example.test', {
      username: 'capitainerie',
      email: 'equipe@example.test',
      password: '',
    });
    assert.equal(updated.email, 'equipe@example.test');
    assert.equal((await findUserByEmail('equipe@example.test')).username, 'capitainerie');

    const replacement = await createUser({
      username: 'remplaçant',
      email: 'remplacant@example.test',
      password: 'autre-mot-de-passe',
    });
    await deleteUser('equipe@example.test', replacement.id);
    assert.equal(await User.countDocuments(), 1);
  });

  test('interdit la suppression du dernier utilisateur', async () => {
    const user = await createUser({
      username: 'unique',
      email: 'unique@example.test',
      password: 'mot-de-passe-test',
    });

    await assert.rejects(
      deleteUser('unique@example.test', '000000000000000000000001'),
      (error) => errorStatus(error) === 409,
    );
  });
});
