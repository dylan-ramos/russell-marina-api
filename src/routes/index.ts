import { Router } from 'express';

import {
  loginAction,
  logoutAction,
  showDashboardAction,
  showHomePageAction,
} from '../controllers/authentication.js';
import { requireAuthentication } from '../middlewares/authentication.js';
import { provideCsrfToken, verifyCsrfToken } from '../middlewares/csrf.js';
import { loginRateLimit } from '../middlewares/login-rate-limit.js';

const router = Router();

router.get('/', provideCsrfToken, showHomePageAction);
router.post('/login', loginRateLimit, provideCsrfToken, verifyCsrfToken, loginAction);
router.get('/logout', logoutAction);
router.get('/dashboard', requireAuthentication, showDashboardAction);

export default router;
