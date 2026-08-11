import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

import {
  createUser,
  deleteUser,
  findAllUsers,
  findUserByEmail,
  type UserInput,
  updateUser,
} from '../services/users.js';

interface UserFormData {
  username: string;
  email: string;
  password: string;
}

function wantsHtml(request: Request): boolean {
  return request.accepts(['html', 'json']) === 'html';
}

function emailFromRoute(request: Request): string {
  const email = request.params.email;
  return typeof email === 'string' ? email : '';
}

function inputFromBody(body: Request['body']): UserFormData {
  return {
    username: typeof body?.username === 'string' ? body.username : '',
    email: typeof body?.email === 'string' ? body.email : '',
    password: typeof body?.password === 'string' ? body.password : '',
  };
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

  return error instanceof Error ? [error.message] : ["L'utilisateur ne peut pas être enregistré."];
}

function handleFormError(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
  mode: 'create' | 'edit',
  user: UserFormData,
  originalEmail = '',
): void {
  const status = errorStatus(error);

  if (!status) {
    next(error);
    return;
  }

  if (!wantsHtml(request)) {
    response.status(status).json({ error: { status, messages: errorMessages(error) } });
    return;
  }

  response.status(status).render('users/form', {
    title: mode === 'create' ? 'Ajouter un utilisateur' : "Modifier l'utilisateur",
    mode,
    originalEmail,
    user: { ...user, password: '' },
    errors: errorMessages(error),
  });
}

function successNotification(request: Request): string | undefined {
  const messages: Record<string, string> = {
    created: "L'utilisateur a été créé.",
    updated: "L'utilisateur a été modifié.",
    deleted: "L'utilisateur a été supprimé.",
  };
  const key = typeof request.query.success === 'string' ? request.query.success : '';
  return messages[key];
}

export const listUsersAction: RequestHandler = async (request, response, next) => {
  try {
    const users = await findAllUsers();

    if (!wantsHtml(request)) {
      response.status(200).json(users);
      return;
    }

    response.render('users/list', {
      title: 'Utilisateurs',
      users,
      notification: successNotification(request),
    });
  } catch (error) {
    next(error);
  }
};

export const showUserAction: RequestHandler = async (request, response, next) => {
  try {
    const user = await findUserByEmail(emailFromRoute(request));

    if (!wantsHtml(request)) {
      response.status(200).json(user);
      return;
    }

    response.render('users/detail', { title: user.username, user, error: undefined });
  } catch (error) {
    next(error);
  }
};

export const showCreateUserFormAction: RequestHandler = (_request, response) => {
  response.render('users/form', {
    title: 'Ajouter un utilisateur',
    mode: 'create',
    originalEmail: '',
    user: { username: '', email: '', password: '' },
    errors: [],
  });
};

export const createUserAction: RequestHandler = async (request, response, next) => {
  const input = inputFromBody(request.body);

  try {
    const user = await createUser(input as UserInput);

    if (!wantsHtml(request)) {
      response
        .location(`/users/${encodeURIComponent(user.email)}`)
        .status(201)
        .json(user);
      return;
    }

    response.redirect('/users?success=created');
  } catch (error) {
    handleFormError(error, request, response, next, 'create', input);
  }
};

export const showEditUserFormAction: RequestHandler = async (request, response, next) => {
  try {
    const user = await findUserByEmail(emailFromRoute(request));
    response.render('users/form', {
      title: "Modifier l'utilisateur",
      mode: 'edit',
      originalEmail: user.email,
      user: { username: user.username, email: user.email, password: '' },
      errors: [],
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserAction: RequestHandler = async (request, response, next) => {
  const input = inputFromBody(request.body);
  const originalEmail = emailFromRoute(request);

  try {
    const user = await updateUser(originalEmail, input);

    if (!wantsHtml(request)) {
      response.status(200).json(user);
      return;
    }

    response.redirect('/users?success=updated');
  } catch (error) {
    handleFormError(error, request, response, next, 'edit', input, originalEmail);
  }
};

export const deleteUserAction: RequestHandler = async (request, response, next) => {
  try {
    await deleteUser(emailFromRoute(request), request.session.userId ?? '');

    if (!wantsHtml(request)) {
      response.status(204).end();
      return;
    }

    response.redirect('/users?success=deleted');
  } catch (error) {
    if (!wantsHtml(request) || errorStatus(error) !== 409) {
      next(error);
      return;
    }

    try {
      const user = await findUserByEmail(emailFromRoute(request));
      response.status(409).render('users/detail', {
        title: user.username,
        user,
        error: errorMessages(error)[0],
      });
    } catch (renderError) {
      next(renderError);
    }
  }
};
