import config from './env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, silent: 99 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

const COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

function write(level, message, meta) {
  if (threshold < LEVELS[level]) return;
  if (config.isProduction) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...(meta || {}) }));
    return;
  }
  const color = COLORS[level] || '';
  const ts = new Date().toISOString().slice(11, 23);
  console.log(
    `${color}[${ts}] ${level.toUpperCase().padEnd(5)}${COLORS.reset} ${message}`,
    meta && Object.keys(meta).length ? meta : '',
  );
}

const logger = {
  error: (msg, meta) => write('error', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  debug: (msg, meta) => write('debug', msg, meta),
  child: () => logger,
};

export default logger;
