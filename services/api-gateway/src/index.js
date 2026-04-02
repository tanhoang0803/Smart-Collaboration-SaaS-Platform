// =============================================================================
// API Gateway — entry point
//
// Responsibilities:
//  - Create the HTTP server from the Express app factory
//  - Listen on PORT (default 8080)
//  - Handle graceful shutdown on SIGTERM / SIGINT
//    (stop accepting → wait for in-flight requests → close Redis)
//
// Why graceful shutdown matters:
//  - Kubernetes sends SIGTERM before killing the pod (default 30 s grace period)
//  - Docker Compose sends SIGTERM on `docker-compose stop` / `docker-compose down`
//  - Graceful close allows in-flight proxy requests to complete
//  - Prevents broken pipe errors on clients mid-request
// =============================================================================

import http from 'http';
import { createApp } from './app.js';
import { redis } from './redis/client.js';
import logger from './utils/logger.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Maximum time to wait for in-flight requests to drain before force-exiting
const SHUTDOWN_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Create server
// ---------------------------------------------------------------------------
const app = createApp();
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  logger.info(
    { port: PORT, host: HOST, env: process.env.NODE_ENV || 'development' },
    'API gateway started',
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

  // 1. Stop accepting new connections; wait for in-flight requests to drain
  const serverClosePromise = new Promise((resolve) => {
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
      } else {
        logger.info('HTTP server closed — all connections drained');
      }
      resolve();
    });
  });

  // 2. Hard timeout — don't wait forever if a client is holding a connection
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      logger.warn(
        { timeoutMs: SHUTDOWN_TIMEOUT_MS },
        'Shutdown timeout exceeded — forcing exit',
      );
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
  });

  // Race: whichever completes first (server drained vs timeout)
  await Promise.race([serverClosePromise, timeoutPromise]);

  // 3. Close Redis connection cleanly
  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing Redis connection');
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Unhandled errors — log loudly and initiate graceful shutdown
//
// Unhandled rejections and uncaught exceptions are bugs. Crashing the process
// (after draining) is safer than running in an unknown state.
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException').catch(() => process.exit(1));
});

export default server;
