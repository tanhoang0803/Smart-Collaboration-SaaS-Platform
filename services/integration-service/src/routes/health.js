import { Router } from 'express';
import { register } from '../utils/metrics.js';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'integration-service', timestamp: new Date().toISOString() });
});

router.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
