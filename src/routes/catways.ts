import { Router } from 'express';

import {
  createCatway,
  deleteCatway,
  listCatways,
  showCatway,
  showCreateCatwayForm,
  showEditCatwayForm,
  updateCatway,
} from '../controllers/catways.js';
import { requireAuthentication } from '../middlewares/authentication.js';
import { provideCsrfToken, verifyCsrfToken } from '../middlewares/csrf.js';

const router = Router();

router.use(requireAuthentication, provideCsrfToken);

router.get('/', listCatways);
router.get('/new', showCreateCatwayForm);
router.get('/:id/edit', showEditCatwayForm);
router.get('/:id', showCatway);
router.post('/', verifyCsrfToken, createCatway);
router.put('/:id', verifyCsrfToken, updateCatway);
router.delete('/:id', verifyCsrfToken, deleteCatway);

export default router;
