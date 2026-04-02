// =============================================================================
// Prometheus metrics — prom-client
//
// Exports:
//  - httpRequestsTotal   Counter — total HTTP requests by service/method/status/route
//  - httpRequestDurationMs  Histogram — request latency in milliseconds
//  - register            The default prom-client registry (used by /metrics endpoint)
//
// Default Node.js metrics (memory, CPU, event-loop lag, GC) are also collected
// under the 'gateway_' prefix to avoid collisions when scraping multiple services.
// =============================================================================

import client from 'prom-client';

// Collect default Node.js process metrics (CPU, memory, event-loop, GC, etc.)
// prefixed with 'gateway_' to namespace them in Prometheus
client.collectDefaultMetrics({ prefix: 'gateway_' });

// ---------------------------------------------------------------------------
// Counter — total requests processed
// Labels allow slicing by downstream service, HTTP method, status code, route
// ---------------------------------------------------------------------------
export const httpRequestsTotal = new client.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests processed by the API gateway',
  labelNames: ['service', 'method', 'status', 'route'],
});

// ---------------------------------------------------------------------------
// Histogram — request duration in milliseconds
// Buckets cover the golden signal latency range up to 5 seconds (for slow AI calls)
// ---------------------------------------------------------------------------
export const httpRequestDurationMs = new client.Histogram({
  name: 'gateway_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['service', 'method', 'status', 'route'],
  buckets: [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
});

// ---------------------------------------------------------------------------
// Gauge — number of active upstream connections (proxy in-flight requests)
// ---------------------------------------------------------------------------
export const activeProxyRequests = new client.Gauge({
  name: 'gateway_active_proxy_requests',
  help: 'Number of proxy requests currently in-flight to downstream services',
  labelNames: ['service'],
});

// Export the default registry so /metrics can call register.metrics()
export const register = client.register;
