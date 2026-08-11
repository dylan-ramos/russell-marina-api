import type { RequestHandler } from 'express';

import { SESSION_COOKIE_NAME } from '../config/session.js';
import { rotateCsrfToken } from '../middlewares/csrf.js';
import { User } from '../models/user.js';

const HOME_TITLE = 'Russell Marina API';

function regenerateSession(request: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function saveSession(request: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export const showHomePage: RequestHandler = (request, response) => {
  if (request.session.userId) {
    response.redirect('/dashboard');
    return;
  }

  response.render('index', {
    title: HOME_TITLE,
    error:
      request.query.authentication === 'required'
        ? 'Vous devez vous connecter pour accéder à cette page.'
        : undefined,
    email: '',
  });
};

export const login: RequestHandler = async (request, response, next) => {
  try {
    const email =
      typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';

    if (!email || !password) {
      response.status(400).render('index', {
        title: HOME_TITLE,
        error: "L'adresse email et le mot de passe sont obligatoires.",
        email,
      });
      return;
    }

    const user = await User.findOne({ email }).select('+password');
    const isPasswordValid = user ? await user.comparePassword(password) : false;

    if (!user || !isPasswordValid) {
      response.status(401).render('index', {
        title: HOME_TITLE,
        error: 'Adresse email ou mot de passe incorrect.',
        email,
      });
      return;
    }

    await regenerateSession(request);
    request.session.userId = user.id;
    rotateCsrfToken(request);
    await saveSession(request);
    response.redirect('/dashboard');
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    response.redirect('/');
  });
};

export const showDashboard: RequestHandler = (_request, response) => {
  response.render('dashboard', {
    title: 'Tableau de bord',
    currentUser: response.locals.currentUser,
    today: new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeZone: 'Europe/Paris',
    }).format(new Date()),
  });
};

export const showDocumentationPlaceholder: RequestHandler = (_request, response) => {
  response.render('documentation', { title: "Documentation de l'API" });
};
