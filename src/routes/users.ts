import { Router } from 'express';

const router = Router();

router.get('/', (_request, response) => {
  response.send('Users resource');
});

export default router;
