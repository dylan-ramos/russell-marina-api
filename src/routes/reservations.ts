import { Router } from 'express';

import {
  createReservationAction,
  deleteReservationAction,
  listAllReservationsAction,
  listCatwayReservationsAction,
  showCreateReservationFormAction,
  showEditReservationFormAction,
  showReservationAction,
  updateReservationAction,
} from '../controllers/reservations.js';
import { requireAuthentication } from '../middlewares/authentication.js';
import { provideCsrfToken, verifyCsrfToken } from '../middlewares/csrf.js';

export const reservationsOverviewRouter = Router();

reservationsOverviewRouter.use(requireAuthentication, provideCsrfToken);
reservationsOverviewRouter.get('/', listAllReservationsAction);
reservationsOverviewRouter.get('/new', showCreateReservationFormAction);
reservationsOverviewRouter.post('/', verifyCsrfToken, createReservationAction);

export const catwayReservationsRouter = Router({ mergeParams: true });

catwayReservationsRouter.use(requireAuthentication, provideCsrfToken);
catwayReservationsRouter.get('/', listCatwayReservationsAction);
catwayReservationsRouter.get('/new', showCreateReservationFormAction);
catwayReservationsRouter.get('/:idReservation/edit', showEditReservationFormAction);
catwayReservationsRouter.get('/:idReservation', showReservationAction);
catwayReservationsRouter.post('/', verifyCsrfToken, createReservationAction);
catwayReservationsRouter.put('/:idReservation', verifyCsrfToken, updateReservationAction);
catwayReservationsRouter.delete('/:idReservation', verifyCsrfToken, deleteReservationAction);
