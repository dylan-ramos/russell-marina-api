import type { RequestHandler } from 'express';

import { User } from '../models/user.js';

export const requireAuthentication: RequestHandler = async (request, response, next) => {
  try {
    if (!request.session.userId) {
      response.redirect('/?authentication=required');
      return;
    }

    const user = await User.findById(request.session.userId).select('username email').lean();

    if (!user) {
      request.session.destroy(() => {
        response.redirect('/?authentication=required');
      });
      return;
    }

    response.locals.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};
