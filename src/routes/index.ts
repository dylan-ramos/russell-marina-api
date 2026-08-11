import { Router } from 'express';

const router = Router();

router.get('/', (_request, response) => {
  response.render('index', { title: 'Russell Marina API' });
});

export default router;
