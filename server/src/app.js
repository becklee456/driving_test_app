import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from './config/env.js';
import logger from './config/logger.js';
import apiRouter from './routes/index.js';
import { globalLimiter } from './middleware/rate-limit.js';
import { authenticateOptional } from './middleware/auth.js';
import { notFoundHandler, errorHandler, success } from './middleware/error.js';

function corsOptions() {
  const allowed = new Set(config.corsOrigins);
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true); // same-origin, curl, mobile apps
      if (allowed.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-protection', 'Accept-Language'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400,
  };
}

export function createApp() {
  const app = express();

  app.set('trust proxy', config.security.trustProxy ? 1 : false);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser(config.cookies.secret));

  if (!config.isTest) {
    app.use(
      morgan(config.isProduction ? 'combined' : 'dev', {
        stream: { write: (line) => logger.info(line.trim()) },
        skip: (req) => req.path === '/api/health',
      }),
    );
  }

  app.use(authenticateOptional);
  app.use('/api', globalLimiter);

  app.get('/api/health', (_req, res) =>
    success(res, { status: 'ok', uptime: Math.round(process.uptime()), env: config.env, time: new Date().toISOString() }),
  );

  app.use('/api', apiRouter);

  // Serve the built SPA in production (single-service deployment).
  if (config.isProduction) {
    const clientDist = path.resolve(config.serverRoot, '..', 'client', 'dist');
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist, { maxAge: '7d', index: false }));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        return res.sendFile(path.join(clientDist, 'index.html'));
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
