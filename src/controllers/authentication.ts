import type { RequestHandler } from 'express';

import { SESSION_COOKIE_NAME } from '../config/session.js';
import { rotateCsrfToken } from '../middlewares/csrf.js';
import { Catway } from '../models/catway.js';
import { Reservation } from '../models/reservation.js';
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

export const showHomePageAction: RequestHandler = (request, response) => {
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

export const loginAction: RequestHandler = async (request, response, next) => {
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

export const logoutAction: RequestHandler = (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    response.redirect('/');
  });
};

export const showDashboardAction: RequestHandler = async (_request, response, next) => {
  try {
    const now = new Date();
    const [currentReservations, catwayCount, reservationCount, userCount] = await Promise.all([
      Reservation.find({ startDate: { $lte: now }, endDate: { $gte: now } }).sort({
        endDate: 1,
        catwayNumber: 1,
      }),
      Catway.countDocuments(),
      Reservation.countDocuments(),
      User.countDocuments(),
    ]);
    const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeZone: 'Europe/Paris',
    });

    response.render('dashboard', {
      title: 'Tableau de bord',
      currentUser: response.locals.currentUser,
      today: dateFormatter.format(now),
      currentReservations,
      dateFormatter,
      statistics: { catwayCount, reservationCount, userCount },
    });
  } catch (error) {
    next(error);
  }
};
