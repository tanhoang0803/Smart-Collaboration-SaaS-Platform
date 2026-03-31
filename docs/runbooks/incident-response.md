# Incident Response Runbook

## Severity Levels

| Level | Definition | Response Time |
|---|---|---|
| P1 — Critical | Service fully down, data loss risk | Immediate |
| P2 — High | Major feature broken, >10% error rate | < 30 min |
| P3 — Medium | Degraded performance, single feature affected | < 4 hours |
| P4 — Low | Minor bug, cosmetic issue | Next sprint |

---

## P1: Service Down

```bash
# 1. Check which service is down
curl https://api.yourdomain.com/healthz

# 2. Check container logs
docker logs <container-name> --tail 100

# 3. Check DB connectivity
docker-compose exec postgres pg_isready

# 4. Check Redis
docker-compose exec redis redis-cli ping

# 5. Restart failing container
docker-compose restart <service-name>

# 6. If DB is down — check connection pool exhaustion
# → Scale down services temporarily, restart DB, scale back up

# 7. If unresolvable in 10 min → rollback to last known good deploy
```

---

## P2: High Error Rate

```bash
# 1. Check Grafana error rate dashboard
# Alert: service error rate > 5% for 2 min

# 2. Check Kibana for error patterns
# Filter: level:error AND service:<name> AND @timestamp:[now-15m TO now]

# 3. Identify the error code in logs
# Common patterns:
#   ECONNREFUSED → DB or Redis connection issue
#   JWT errors → auth service or key rotation issue
#   429 from OpenAI → rate limit, check AI service cache

# 4. Apply targeted fix or rollback
```

---

## Security Incident: Suspected Token Compromise

```bash
# 1. Immediately blacklist all tokens for the affected user
# POST /api/v1/auth/revoke-all { userId }

# 2. Rotate JWT signing keys
# Generate new RS256 keypair, update secrets in GitHub Secrets
# Redeploy all services

# 3. Audit log review
# SELECT * FROM audit_logs WHERE user_id = '<id>' ORDER BY created_at DESC LIMIT 100;

# 4. Notify affected tenant admin
```

---

## Monitoring Endpoints

| Tool | URL | Use |
|---|---|---|
| Grafana | http://localhost:3001 | Service metrics dashboards |
| Prometheus | http://localhost:9090 | Raw metrics query |
| Kibana | http://localhost:5601 | Log search and analysis |
