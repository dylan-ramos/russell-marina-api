#!/usr/bin/env node

import debugFactory from 'debug';
import http from 'node:http';

import app from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const debug = debugFactory('russell-marina-api:server');
const port = normalizePort(process.env.PORT ?? '3000');

app.set('port', port);

const server = http.createServer(app);

server.on('error', onError);
server.on('listening', onListening);

let isShuttingDown = false;

async function startServer(): Promise<void> {
  await connectDatabase();
  server.listen(port);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`${signal} reçu, arrêt de l'application.`);

  if (server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await disconnectDatabase();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error("L'arrêt propre de l'application a échoué :", error);
        process.exit(1);
      });
  });
}

void startServer().catch((error: unknown) => {
  console.error(
    'Impossible de démarrer le serveur :',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});

function normalizePort(value: string): number | string | false {
  const parsedPort = Number.parseInt(value, 10);

  if (Number.isNaN(parsedPort)) {
    return value;
  }

  return parsedPort >= 0 ? parsedPort : false;
}

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
    default:
      throw error;
  }
}

function onListening(): void {
  const address = server.address();
  const bind = typeof address === 'string' ? `pipe ${address}` : `port ${address?.port ?? port}`;

  debug(`Listening on ${bind}`);
}
