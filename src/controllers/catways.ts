import createError from 'http-errors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

import { Catway, CATWAY_TYPES, type CatwayType } from '../models/catway.js';
import { Reservation } from '../models/reservation.js';

interface CatwayFormData {
  catwayNumber: number | string;
  catwayType: CatwayType | string;
  catwayState: string;
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

function validationMessages(error: MongooseError.ValidationError): string[] {
  return Object.values(error.errors).map((validationError) => validationError.message);
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function handleFormError(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
  mode: 'create' | 'edit',
  catway: CatwayFormData,
): void {
  let status = 500;
  let errors: string[] = [];

  if (error instanceof MongooseError.ValidationError) {
    status = 422;
    errors = validationMessages(error);
  } else if (isDuplicateKeyError(error)) {
    status = 409;
    errors = ['Ce numéro de catway existe déjà.'];
  } else {
    next(error);
    return;
  }

  if (!wantsHtml(request)) {
    response.status(status).json({ error: { status, messages: errors } });
    return;
  }

  response.status(status).render('catways/form', {
    title: mode === 'create' ? 'Ajouter un catway' : `Modifier le catway ${catway.catwayNumber}`,
    mode,
    catway,
    catwayTypes: CATWAY_TYPES,
    errors,
  });
}

export const listCatways: RequestHandler = async (request, response, next) => {
  try {
    const catways = await Catway.find().sort({ catwayNumber: 1 });

    if (!wantsHtml(request)) {
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

export const showCatway: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.id ?? '');
    const catway = await Catway.findOne({ catwayNumber });

    if (!catway) {
      next(createError(404, `Le catway ${catwayNumber} n'existe pas.`));
      return;
    }

    if (!wantsHtml(request)) {
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

export const showCreateCatwayForm: RequestHandler = (_request, response) => {
  response.render('catways/form', {
    title: 'Ajouter un catway',
    mode: 'create',
    catway: { catwayNumber: '', catwayType: 'short', catwayState: '' },
    catwayTypes: CATWAY_TYPES,
    errors: [],
  });
};

export const createCatway: RequestHandler = async (request, response, next) => {
  const formData = formDataFromBody(request.body);

  try {
    const catway = await Catway.create({
      catwayNumber: Number(formData.catwayNumber),
      catwayType: formData.catwayType as CatwayType,
      catwayState: formData.catwayState,
    });

    if (!wantsHtml(request)) {
      response.location(`/catways/${catway.catwayNumber}`).status(201).json(catway);
      return;
    }

    response.redirect('/catways?success=created');
  } catch (error) {
    handleFormError(error, request, response, next, 'create', formData);
  }
};

export const showEditCatwayForm: RequestHandler = async (request, response, next) => {
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

export const updateCatway: RequestHandler = async (request, response, next) => {
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

      if (!wantsHtml(request)) {
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

    if (!wantsHtml(request)) {
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

export const deleteCatway: RequestHandler = async (request, response, next) => {
  try {
    const catwayNumber = parseCatwayNumber(request.params.id ?? '');
    const catway = await Catway.findOne({ catwayNumber });

    if (!catway) {
      next(createError(404, `Le catway ${catwayNumber} n'existe pas.`));
      return;
    }

    const hasReservations = await Reservation.exists({ catwayNumber });

    if (hasReservations) {
      const message = 'Ce catway ne peut pas être supprimé car il possède des réservations.';

      if (!wantsHtml(request)) {
        response.status(409).json({ error: { status: 409, message } });
        return;
      }

      response.status(409).render('catways/detail', {
        title: `Catway ${catwayNumber}`,
        catway,
        error: message,
      });
      return;
    }

    await catway.deleteOne();

    if (!wantsHtml(request)) {
      response.status(204).end();
      return;
    }

    response.redirect('/catways?success=deleted');
  } catch (error) {
    next(error);
  }
};
