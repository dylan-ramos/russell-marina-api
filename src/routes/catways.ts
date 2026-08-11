import { Router } from 'express';

import {
  createCatwayAction,
  deleteCatwayAction,
  listCatwaysAction,
  showCatwayAction,
  showCreateCatwayFormAction,
  showEditCatwayFormAction,
  updateCatwayAction,
} from '../controllers/catways.js';
import { requireAuthentication } from '../middlewares/authentication.js';
import { provideCsrfToken, verifyCsrfToken } from '../middlewares/csrf.js';

const router = Router();

router.use(requireAuthentication, provideCsrfToken);

router.get('/', listCatwaysAction);
router.get('/new', showCreateCatwayFormAction);
router.get('/:id/edit', showEditCatwayFormAction);
router.get('/:id', showCatwayAction);
router.post('/', verifyCsrfToken, createCatwayAction);
router.put('/:id', verifyCsrfToken, updateCatwayAction);
router.delete('/:id', verifyCsrfToken, deleteCatwayAction);

export default router;
