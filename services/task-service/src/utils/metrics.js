import client from 'prom-client';

const { Registry, collectDefaultMetrics, Counter, Histogram } = client;

export const register = new Registry();
register.setDefaultLabels({ service: 'task-service' });
collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [register],
});

export const taskCreatedTotal = new Counter({
  name: 'task_created_total',
  help: 'Total number of tasks created',
  labelNames: ['tenant_id'],
  registers: [register],
});
