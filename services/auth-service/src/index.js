// =============================================================================
// Auth Service — entry point
//
// Responsibilities:
//  - Create the HTTP server
//  - Listen on PORT (default 3001)
//  - Handle graceful shutdown on SIGTERM / SIGINT
//    (close HTTP server → drain DB pool → close Redis)
//
// Why graceful shutdown?
//  - Kubernetes sends SIGTERM before killing the pod
//  - Allows in-flight requests to complete (server.close waits for them)
//  - Avoids leaving open DB/Redis connections in the pool
// =============================================================================

import http from 'http';
import app from './app.js';
import db from './db/client.js';
import { redis } from './redis/client.js';
import logger from './utils/logger.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Give in-flight requests up to 30 s to complete during shutdown
const SHUTDOWN_TIMEOUT_MS = 30_000;

const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

server.listen(PORT, HOST, () => {
  logger.info(
    { port: PORT, host: HOST, env: process.env.NODE_ENV || 'development' },
    'Auth service started',
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

  // 1. Stop accepting new connections
  const serverClosePromise = new Promise((resolve) => {
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
      } else {
        logger.info('HTTP server closed');
      }
      resolve();
    });
  });

  // 2. Enforce a maximum shutdown timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      logger.warn('Shutdown timeout exceeded — forcing exit');
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
  });

  // Wait for server close (or timeout)
  await Promise.race([serverClosePromise, timeoutPromise]);

  // 3. Close database connection pool
  try {
    await db.destroy();
    logger.info('PostgreSQL pool closed');
  } catch (err) {
    logger.error({ err }, 'Error closing PostgreSQL pool');
  }

  // 4. Close Redis connection
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

// Handle unhandled promise rejections — log and exit
// (unhandled rejections = bugs; we want the process to crash loudly)
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException').catch(() => process.exit(1));
});

export default server;
