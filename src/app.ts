import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import methodOverride from 'method-override';
import logger from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';

import { openApiDocument } from './config/openapi.js';
import { createSessionMiddleware } from './config/session.js';
import catwaysRouter from './routes/catways.js';
import indexRouter from './routes/index.js';
import { catwayReservationsRouter, reservationsOverviewRouter } from './routes/reservations.js';
import usersRouter from './routes/users.js';

const app = express();
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.set('trust proxy', 1);
}

app.set('views', path.join(projectRoot, 'views'));
app.set('view engine', 'ejs');

const applicationSecurityHeaders = helmet(isProduction ? {} : { contentSecurityPolicy: false });
const documentationSecurityHeaders = helmet({ contentSecurityPolicy: false });
app.use((request, response, next) => {
  const securityHeaders = request.path.startsWith('/api-docs')
    ? documentationSecurityHeaders
    : applicationSecurityHeaders;
  securityHeaders(request, response, next);
});
app.use(logger(isProduction ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(express.static(path.join(projectRoot, 'public')));
app.get('/openapi.json', (_request, response) => {
  response.status(200).json(openApiDocument);
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'Documentation — Russell Marina API',
    swaggerOptions: { persistAuthorization: true },
  }),
);
app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});
app.use(createSessionMiddleware());

app.use('/', indexRouter);
app.use('/reservations', reservationsOverviewRouter);
app.use('/catways/:catwayNumber/reservations', catwayReservationsRouter);
app.use('/catways', catwaysRouter);
app.use('/users', usersRouter);

app.use((_request, _response, next) => {
  next(createError(404));
});

const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const status = typeof error.status === 'number' ? error.status : 500;
  const message =
    status === 500 && isProduction ? 'Une erreur interne est survenue.' : error.message;

  if (request.accepts(['html', 'json']) === 'json') {
    response.status(status).json({ error: { status, message } });
    return;
  }

  response.locals.message = message;
  response.locals.error = request.app.get('env') === 'development' ? error : {};
  response.locals.status = status;
  response.status(status);
  response.render('error');
};

app.use(errorHandler);

export default app;
