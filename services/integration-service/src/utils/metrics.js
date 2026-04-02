import client from 'prom-client';

const { Registry, collectDefaultMetrics, Counter, Histogram } = client;

export const register = new Registry();
register.setDefaultLabels({ service: 'integration-service' });
collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [register],
});

export const webhookReceivedTotal = new Counter({
  name: 'webhook_received_total',
  help: 'Total number of webhooks received',
  labelNames: ['provider'],
  registers: [register],
});

export const syncTotal = new Counter({
  name: 'integration_sync_total',
  help: 'Total number of integration syncs triggered',
  labelNames: ['provider', 'status'],
  registers: [register],
});
