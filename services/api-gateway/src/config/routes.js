// =============================================================================
// Downstream service URL configuration
//
// In production (Docker Compose / Kubernetes) the service names resolve via
// internal DNS. In local development outside Docker, override these with
// environment variables pointing to localhost ports.
//
// Example .env overrides for running gateway locally:
//   AUTH_SERVICE_URL=http://localhost:3001
//   TASK_SERVICE_URL=http://localhost:3002
//   INTEGRATION_SERVICE_URL=http://localhost:3003
//   AI_SERVICE_URL=http://localhost:3004
// =============================================================================

export const SERVICE_URLS = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  tasks: process.env.TASK_SERVICE_URL || 'http://task-service:3002',
  integrations: process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:3003',
  ai: process.env.AI_SERVICE_URL || 'http://ai-service:3004',
};
