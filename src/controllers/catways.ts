import createError from 'http-errors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { Catway, CATWAY_TYPES, type CatwayType } from '../models/catway.js';
import { Reservation } from '../models/reservation.js';
import { withCatwayLock } from '../services/catway-locks.js';
import { httpErrorDetails, requestWantsHtml } from '../utils/http.js';

interface CatwayFormData {
  catwayNumber: number | string;
  catwayType: CatwayType | string;
  catwayState: string;
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

function formDataFromBody(body: Request['body']): CatwayFormData {
  return {
    catwayNumber:
      typeof body.catwayNumber === 'string' || typeof body.catwayNumber === 'number'
        ? body.catwayNumber
        : '',
    catwayType: typeof body.catwayType === 'string' ? body.catwayType : '',
    catwayState: typeof body.catwayState === 'string' ? body.catwayState : '',
  };
}

function handleFormError(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
  mode: 'create' | 'edit',
  catway: CatwayFormData,
): void {
  const details = httpErrorDetails(error, {
    duplicateMessage: 'Ce numéro de catway existe déjà.',
  });

  if (!details) {
    next(error);
    return;
  }

  if (!requestWantsHtml(request)) {
    response.status(details.status).json({ error: details });
    return;
  }

  response.status(details.status).render('catways/form', {
    title: mode === 'create' ? 'Ajouter un catway' : `Modifier le catway ${catway.catwayNumber}`,
    mode,
    catway,
    catwayTypes: CATWAY_TYPES,
    errors: details.messages,
  });
}

export const listCatwaysAction: RequestHandler = async (request, response, next) => {
  try {
    const catways = await Catway.find().sort({ catwayNumber: 1 });

    if (!requestWantsHtml(request)) {
      response.status(200).json(catways);
      return;
    }

    const messages: Record<string, string> = {
      created: 'Le catway a été créé.',
      updated: "L'état du catway a été modifié.",
      deleted: 'Le catway a été supprimé.',
    };
    const notificationKey = typeof request.query.success === 'string' ? request.query.success : '';

    response.render('catways/list', {
      title: 'Catways',
      catways,
      notification: messages[notificationKey],
    });
  } catch (error) {
    next(error);
  }
};

export const showCatwayAction: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.id ?? '');
    const catway = await Catway.findOne({ catwayNumber });

    if (!catway) {
      next(createError(404, `Le catway ${catwayNumber} n'existe pas.`));
      return;
    }

    if (!requestWantsHtml(request)) {
      response.status(200).json(catway);
      return;
    }

    response.render('catways/detail', {
      title: `Catway ${catwayNumber}`,
      catway,
      error: undefined,
    });
  } catch (error) {
    next(error);
  }
};

export const showCreateCatwayFormAction: RequestHandler = (_request, response) => {
  response.render('catways/form', {
    title: 'Ajouter un catway',
    mode: 'create',
    catway: { catwayNumber: '', catwayType: 'short', catwayState: '' },
    catwayTypes: CATWAY_TYPES,
    errors: [],
  });
};

export const createCatwayAction: RequestHandler = async (request, response, next) => {
  const formData = formDataFromBody(request.body);

  try {
    const catway = await Catway.create({
      catwayNumber: Number(formData.catwayNumber),
      catwayType: formData.catwayType as CatwayType,
      catwayState: formData.catwayState,
    });

    if (!requestWantsHtml(request)) {
      response.location(`/catways/${catway.catwayNumber}`).status(201).json(catway);
      return;
    }

    response.redirect('/catways?success=created');
  } catch (error) {
    handleFormError(error, request, response, next, 'create', formData);
  }
};

export const showEditCatwayFormAction: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.id ?? '');
    const catway = await Catway.findOne({ catwayNumber });

    if (!catway) {
      next(createError(404, `Le catway ${catwayNumber} n'existe pas.`));
      return;
    }

    response.render('catways/form', {
      title: `Modifier le catway ${catwayNumber}`,
      mode: 'edit',
      catway,
      catwayTypes: CATWAY_TYPES,
      errors: [],
    });
  } catch (error) {
    next(error);
  }
};

export const updateCatwayAction: RequestHandler = async (request, response, next) => {
  let catwayNumber: number;

  try {
    catwayNumber = parseCatwayNumber(request.params.id ?? '');
  } catch (error) {
    next(error);
    return;
  }

  try {
    const catway = await Catway.findOne({ catwayNumber });

    if (!catway) {
      next(createError(404, `Le catway ${catwayNumber} n'existe pas.`));
      return;
    }

    if ('catwayNumber' in request.body || 'catwayType' in request.body) {
      const message = "Seule la description de l'état du catway peut être modifiée.";

      if (!requestWantsHtml(request)) {
        response.status(400).json({ error: { status: 400, message } });
        return;
      }

      response.status(400).render('catways/form', {
        title: `Modifier le catway ${catwayNumber}`,
        mode: 'edit',
        catway,
        catwayTypes: CATWAY_TYPES,
        errors: [message],
      });
      return;
    }

    catway.catwayState =
      typeof request.body.catwayState === 'string' ? request.body.catwayState : '';
    await catway.save();

    if (!requestWantsHtml(request)) {
      response.status(200).json(catway);
      return;
    }

    response.redirect('/catways?success=updated');
  } catch (error) {
    handleFormError(error, request, response, next, 'edit', {
      catwayNumber,
      catwayType: '',
      catwayState: typeof request.body.catwayState === 'string' ? request.body.catwayState : '',
    });
  }
};

export const deleteCatwayAction: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.id ?? '');
    const result = await withCatwayLock(catwayNumber, async () => {
      const catway = await Catway.findOne({ catwayNumber });

      if (!catway) {
        throw createError(404, `Le catway ${catwayNumber} n'existe pas.`);
      }

      const hasReservations = await Reservation.exists({ catwayNumber });
      if (hasReservations) {
        return { catway, deleted: false } as const;
      }

      await catway.deleteOne();
      return { catway, deleted: true } as const;
    });

    if (!result.deleted) {
      const message = 'Ce catway ne peut pas être supprimé car il possède des réservations.';

      if (!requestWantsHtml(request)) {
        response.status(409).json({ error: { status: 409, message } });
        return;
      }

      response.status(409).render('catways/detail', {
        title: `Catway ${catwayNumber}`,
        catway: result.catway,
        error: message,
      });
      return;
    }

    if (!requestWantsHtml(request)) {
      response.status(204).end();
      return;
    }

    response.redirect('/catways?success=deleted');
  } catch (error) {
    next(error);
  }
};
