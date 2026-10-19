import http from 'node:http';
import config from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';

async function start() {
  await connectDatabase();
  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.port, () => {
    logger.info(`${config.appName} API iratangira kuri http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    logger.info(`Signal ${signal} yabonetse - dufunga seriveri...`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Seriveri yafunze neza.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  });

  return server;
}

start().catch((err) => {
  logger.error('Kwinjira muri seriveri byanze', { message: err.message });
  process.exit(1);
});

export default start;
