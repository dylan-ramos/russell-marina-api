import createError from 'http-errors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

import {
  createReservation,
  deleteReservation,
  findAllReservations,
  findReservableCatways,
  findReservation,
  findReservationsByCatway,
  type ReservationInput,
  updateReservation,
} from '../services/reservations.js';

interface ReservationFormData {
  clientName: string;
  boatName: string;
  startDate: string;
  endDate: string;
}

function wantsHtml(request: Request): boolean {
  return request.accepts(['html', 'json']) === 'html';
}

function parseCatwayNumber(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw createError(400, 'Le numéro du catway doit être un entier positif.');
  }

  const catwayNumber = Number(value);

  if (!Number.isSafeInteger(catwayNumber) || catwayNumber < 1) {
    throw createError(400, 'Le numéro du catway doit être un entier positif.');
  }

  return catwayNumber;
}

function reservationIdFromRequest(request: Request): string {
  const reservationId = request.params.idReservation;

  if (typeof reservationId !== 'string') {
    throw createError(400, "L'identifiant de la réservation n'est pas valide.");
  }

  return reservationId;
}

function catwayNumberFromRequest(request: Request): number {
  const routeCatwayNumber = request.params.catwayNumber;
  const bodyCatwayNumber = request.body?.catwayNumber;

  if (routeCatwayNumber !== undefined) {
    const catwayNumber = parseCatwayNumber(routeCatwayNumber);

    if (bodyCatwayNumber !== undefined && Number(bodyCatwayNumber) !== catwayNumber) {
      throw createError(400, 'Le numéro du catway ne correspond pas à la route demandée.');
    }

    return catwayNumber;
  }

  return parseCatwayNumber(
    typeof bodyCatwayNumber === 'number' ? String(bodyCatwayNumber) : bodyCatwayNumber,
  );
}

function inputFromBody(body: Request['body']): ReservationFormData {
  return {
    clientName: typeof body?.clientName === 'string' ? body.clientName : '',
    boatName: typeof body?.boatName === 'string' ? body.boatName : '',
    startDate: typeof body?.startDate === 'string' ? body.startDate : '',
    endDate: typeof body?.endDate === 'string' ? body.endDate : '',
  };
}

function dateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function errorStatus(error: unknown): number | undefined {
  if (error instanceof MongooseError.ValidationError) {
    return 422;
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number(error.status);
    return Number.isInteger(status) ? status : undefined;
  }

  return undefined;
}

function errorMessages(error: unknown): string[] {
  if (error instanceof MongooseError.ValidationError) {
    return Object.values(error.errors).map((validationError) => validationError.message);
  }

  if (error instanceof Error) {
    return [error.message];
  }

  return ['La réservation ne peut pas être enregistrée.'];
}

async function renderFormError(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
  mode: 'create' | 'edit',
  catwayNumber: number,
  reservation: ReservationFormData & { id?: string },
  catwayLocked: boolean,
): Promise<void> {
  const status = errorStatus(error);

  if (!status) {
    next(error);
    return;
  }

  if (!wantsHtml(request)) {
    next(error);
    return;
  }

  try {
    response.status(status).render('reservations/form', {
      title: mode === 'create' ? 'Ajouter une réservation' : 'Modifier la réservation',
      mode,
      catwayNumber,
      catwayLocked,
      catways: catwayLocked ? [] : await findReservableCatways(),
      reservation,
      errors: errorMessages(error),
    });
  } catch (renderError) {
    next(renderError);
  }
}

function successNotification(request: Request): string | undefined {
  const notifications: Record<string, string> = {
    created: 'La réservation a été créée.',
    updated: 'La réservation a été modifiée.',
    deleted: 'La réservation a été supprimée.',
  };
  const key = typeof request.query.success === 'string' ? request.query.success : '';
  return notifications[key];
}

export const listAllReservationsAction: RequestHandler = async (request, response, next) => {
  try {
    const reservations = await findAllReservations();
    response.render('reservations/list', {
      title: 'Réservations',
      reservations,
      selectedCatwayNumber: undefined,
      notification: successNotification(request),
    });
  } catch (error) {
    next(error);
  }
};

export const listCatwayReservationsAction: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.catwayNumber);
    const reservations = await findReservationsByCatway(catwayNumber);

    if (!wantsHtml(request)) {
      response.status(200).json(reservations);
      return;
    }

    response.render('reservations/list', {
      title: `Réservations du catway ${catwayNumber}`,
      reservations,
      selectedCatwayNumber: catwayNumber,
      notification: successNotification(request),
    });
  } catch (error) {
    next(error);
  }
};

export const showReservationAction: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.catwayNumber);
    const reservation = await findReservation(catwayNumber, reservationIdFromRequest(request));

    if (!wantsHtml(request)) {
      response.status(200).json(reservation);
      return;
    }

    response.render('reservations/detail', {
      title: 'Détail de la réservation',
      reservation,
    });
  } catch (error) {
    next(error);
  }
};

export const showCreateReservationFormAction: RequestHandler = async (request, response, next) => {
  try {
    const routeCatwayNumber = request.params.catwayNumber;
    const catwayLocked = routeCatwayNumber !== undefined;
    const catwayNumber = catwayLocked ? parseCatwayNumber(routeCatwayNumber) : 0;
    const catways = await findReservableCatways();

    if (catwayLocked && !catways.some((catway) => catway.catwayNumber === catwayNumber)) {
      next(createError(404, `Le catway ${catwayNumber} n'existe pas.`));
      return;
    }

    response.render('reservations/form', {
      title: 'Ajouter une réservation',
      mode: 'create',
      catwayNumber,
      catwayLocked,
      catways,
      reservation: { clientName: '', boatName: '', startDate: '', endDate: '' },
      errors: [],
    });
  } catch (error) {
    next(error);
  }
};

export const createReservationAction: RequestHandler = async (request, response, next) => {
  const reservationInput = inputFromBody(request.body);
  let catwayNumber = 0;

  try {
    catwayNumber = catwayNumberFromRequest(request);
    const reservation = await createReservation(catwayNumber, reservationInput as ReservationInput);

    if (!wantsHtml(request)) {
      response
        .location(`/catways/${catwayNumber}/reservations/${reservation.id}`)
        .status(201)
        .json(reservation);
      return;
    }

    response.redirect('/reservations?success=created');
  } catch (error) {
    await renderFormError(
      error,
      request,
      response,
      next,
      'create',
      catwayNumber,
      reservationInput,
      request.params.catwayNumber !== undefined,
    );
  }
};

export const showEditReservationFormAction: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.catwayNumber);
    const reservation = await findReservation(catwayNumber, reservationIdFromRequest(request));

    response.render('reservations/form', {
      title: 'Modifier la réservation',
      mode: 'edit',
      catwayNumber,
      catwayLocked: true,
      catways: [],
      reservation: {
        id: reservation.id,
        clientName: reservation.clientName,
        boatName: reservation.boatName,
        startDate: dateForInput(reservation.startDate),
        endDate: dateForInput(reservation.endDate),
      },
      errors: [],
    });
  } catch (error) {
    next(error);
  }
};

export const updateReservationAction: RequestHandler = async (request, response, next) => {
  const reservationInput = inputFromBody(request.body);
  let catwayNumber = 0;

  try {
    catwayNumber = catwayNumberFromRequest(request);
    const reservationId = reservationIdFromRequest(request);
    const reservation = await updateReservation(catwayNumber, reservationId, reservationInput);

    if (!wantsHtml(request)) {
      response.status(200).json(reservation);
      return;
    }

    response.redirect('/reservations?success=updated');
  } catch (error) {
    await renderFormError(
      error,
      request,
      response,
      next,
      'edit',
      catwayNumber,
      {
        ...reservationInput,
        id: typeof request.params.idReservation === 'string' ? request.params.idReservation : '',
      },
      true,
    );
  }
};

export const deleteReservationAction: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.catwayNumber);
    await deleteReservation(catwayNumber, reservationIdFromRequest(request));

    if (!wantsHtml(request)) {
      response.status(204).end();
      return;
    }

    response.redirect('/reservations?success=deleted');
  } catch (error) {
    next(error);
  }
};
