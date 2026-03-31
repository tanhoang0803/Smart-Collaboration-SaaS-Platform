# Deployment Runbook

## Normal Deployment (CI/CD — automatic)

1. Push to `main` branch
2. GitHub Actions runs CI: lint → test → coverage gate
3. On success: Docker images built and pushed to `ghcr.io/tanhoang0803/`
4. Deploy triggers:
   - Frontend: Vercel auto-deploys from `main`
   - Backend services: Render / Fly.io deploy hook triggered by GitHub Actions
5. Verify: check `/healthz` on each service within 2 minutes of deploy

## Manual Deploy (emergency)

```bash
# Build and push a specific service manually
docker build -t ghcr.io/tanhoang0803/task-service:hotfix ./services/task-service
docker push ghcr.io/tanhoang0803/task-service:hotfix

# Trigger Render deploy via API (replace SERVICE_ID and API_KEY)
curl -X POST https://api.render.com/v1/services/$SERVICE_ID/deploys \
  -H "Authorization: Bearer $RENDER_API_KEY"
```

## Rollback

```bash
# Redeploy previous image tag
docker pull ghcr.io/tanhoang0803/task-service:<previous-sha>
# Trigger deploy with previous tag via Render dashboard or API
```

## Database Migrations

```bash
# Run migrations (never run manually in production — CI does this)
docker-compose exec task-service npm run migrate

# Roll back last migration
docker-compose exec task-service npm run migrate:rollback

# Check migration status
docker-compose exec task-service npm run migrate:status
```

## Health Check Endpoints

| Service | URL |
|---|---|
| API Gateway | GET /healthz |
| Auth Service | GET /healthz |
| Task Service | GET /healthz |
| Integration Service | GET /healthz |
| AI Service | GET /healthz |

Response: `200 { "status": "ok", "db": "connected", "redis": "connected" }`
