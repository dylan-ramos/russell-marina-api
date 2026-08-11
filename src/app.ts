import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import logger from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';

const app = express();
const projectRoot = fileURLToPath(new URL('../', import.meta.url));

app.set('views', path.join(projectRoot, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(projectRoot, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

app.use((_request, _response, next) => {
  next(createError(404));
});

const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const status = typeof error.status === 'number' ? error.status : 500;

  response.locals.message = error.message;
  response.locals.error = request.app.get('env') === 'development' ? error : {};
  response.status(status);
  response.render('error');
};

app.use(errorHandler);

export default app;
