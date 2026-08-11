import { Router } from 'express';

import {
  createUserAction,
  deleteUserAction,
  listUsersAction,
  showCreateUserFormAction,
  showEditUserFormAction,
  showUserAction,
  updateUserAction,
} from '../controllers/users.js';
import { requireAuthentication } from '../middlewares/authentication.js';
import { provideCsrfToken, verifyCsrfToken } from '../middlewares/csrf.js';

const router = Router();

router.use(requireAuthentication, provideCsrfToken);
router.get('/', listUsersAction);
router.get('/new', showCreateUserFormAction);
router.get('/:email/edit', showEditUserFormAction);
router.get('/:email', showUserAction);
router.post('/', verifyCsrfToken, createUserAction);
router.put('/:email', verifyCsrfToken, updateUserAction);
router.delete('/:email', verifyCsrfToken, deleteUserAction);

export default router;
