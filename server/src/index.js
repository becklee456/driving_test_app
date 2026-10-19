import http from 'node:http';
import config from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';

// On Vercel the entry module must export the Express app as its default
// export; Vercel invokes it as a single function. Locally we listen on a port.
await connectDatabase();

const app = createApp();

export default app;

if (!process.env.VERCEL) {
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
}
