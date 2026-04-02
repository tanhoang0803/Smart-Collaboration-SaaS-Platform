// =============================================================================
// Prometheus metrics — prom-client
//
// Metrics exposed:
//  - ai_service_* default metrics (CPU, memory, event loop, GC)
//  - ai_requests_total         : counter by provider / operation / status
//  - ai_request_duration_ms    : histogram of end-to-end AI call latency
//  - ai_cache_hits_total       : counter of Redis cache hits
//  - ai_cache_misses_total     : counter of Redis cache misses
//  - ai_tokens_used_total      : counter of OpenAI tokens consumed
// =============================================================================

import client from 'prom-client';

// Collect default Node.js runtime metrics (CPU, memory, GC, event loop)
client.collectDefaultMetrics({ prefix: 'ai_service_' });

// ---------------------------------------------------------------------------
// Request counters
// ---------------------------------------------------------------------------

export const aiRequestsTotal = new client.Counter({
  name: 'ai_requests_total',
  help: 'Total number of AI provider requests, labelled by provider, operation and status',
  labelNames: ['provider', 'operation', 'status'],
});

// ---------------------------------------------------------------------------
// Latency histogram
// Buckets chosen to cover fast cache-backed responses (100ms) through slow
// model calls (30s). Values are in milliseconds.
// ---------------------------------------------------------------------------

export const aiRequestDurationMs = new client.Histogram({
  name: 'ai_request_duration_ms',
  help: 'Duration of AI provider requests in milliseconds',
  labelNames: ['provider', 'operation'],
  buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
});

// ---------------------------------------------------------------------------
// Cache metrics
// ---------------------------------------------------------------------------

export const aiCacheHitsTotal = new client.Counter({
  name: 'ai_cache_hits_total',
  help: 'Number of Redis cache hits for AI suggestion responses',
});

export const aiCacheMissesTotal = new client.Counter({
  name: 'ai_cache_misses_total',
  help: 'Number of Redis cache misses for AI suggestion responses',
});

// ---------------------------------------------------------------------------
// Token usage (OpenAI billing visibility)
// type label: 'prompt' | 'completion'
// ---------------------------------------------------------------------------

export const aiTokensUsed = new client.Counter({
  name: 'ai_tokens_used_total',
  help: 'Total number of OpenAI tokens consumed by type (prompt or completion)',
  labelNames: ['type'],
});

// ---------------------------------------------------------------------------
// Prometheus registry — exported for the /metrics endpoint
// ---------------------------------------------------------------------------

export const register = client.register;
