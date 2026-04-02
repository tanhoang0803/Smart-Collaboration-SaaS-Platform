// =============================================================================
// Integration Service — entry point (port 3003)
// =============================================================================

import http from 'http';
import app from './app.js';
import db from './db/client.js';
import redis from './redis/client.js';
import logger from './utils/logger.js';

const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';
const SHUTDOWN_TIMEOUT_MS = 30_000;

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  logger.info(
    { port: PORT, host: HOST, env: process.env.NODE_ENV || 'development' },
    'Integration service started',
  );
});

server.on('error', (err) => {
  logger.error({ err }, 'HTTP server error');
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Received shutdown signal — starting graceful shutdown');

  const serverClosePromise = new Promise((resolve) => {
    server.close((err) => {
      if (err) logger.error({ err }, 'Error closing HTTP server');
      else logger.info('HTTP server closed');
      resolve();
    });
  });

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => { logger.warn('Shutdown timeout exceeded — forcing exit'); resolve(); }, SHUTDOWN_TIMEOUT_MS);
  });

  await Promise.race([serverClosePromise, timeoutPromise]);

  try { await db.destroy(); logger.info('PostgreSQL pool closed'); }
  catch (err) { logger.error({ err }, 'Error closing PostgreSQL pool'); }

  try { await redis.quit(); logger.info('Redis connection closed'); }
  catch (err) { logger.error({ err }, 'Error closing Redis connection'); }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  shutdown('unhandledRejection').catch(() => process.exit(1));
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException').catch(() => process.exit(1));
});

export default server;
