import { Router } from 'express';

import {
  login,
  logout,
  showDashboard,
  showDocumentationPlaceholder,
  showHomePage,
} from '../controllers/authentication.js';
import { requireAuthentication } from '../middlewares/authentication.js';
import { provideCsrfToken, verifyCsrfToken } from '../middlewares/csrf.js';
import { loginRateLimit } from '../middlewares/login-rate-limit.js';

const router = Router();

router.get('/', provideCsrfToken, showHomePage);
router.post('/login', loginRateLimit, provideCsrfToken, verifyCsrfToken, login);
router.get('/logout', logout);
router.get('/dashboard', requireAuthentication, showDashboard);
router.get('/api-docs', showDocumentationPlaceholder);

export default router;
