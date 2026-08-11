import type { Request, RequestHandler, Response } from 'express';

import { User } from '../models/user.js';

function rejectAuthentication(request: Request, response: Response): void {
  if (request.accepts(['html', 'json']) === 'json') {
    response.status(401).json({
      error: { status: 401, message: 'Vous devez vous connecter pour accéder à cette ressource.' },
    });
    return;
  }

  response.redirect('/?authentication=required');
}

export const requireAuthentication: RequestHandler = async (request, response, next) => {
  try {
    if (!request.session.userId) {
      rejectAuthentication(request, response);
      return;
    }

    const user = await User.findById(request.session.userId).select('username email').lean();

    if (!user) {
      request.session.destroy(() => {
        rejectAuthentication(request, response);
      });
      return;
    }

    response.locals.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};
