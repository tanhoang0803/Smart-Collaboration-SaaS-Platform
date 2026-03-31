Scaffold a new microservice for the Smart Collaboration SaaS Platform.

The user will provide the service name (e.g. `notification-service`).

Generate the following file tree under `services/<service-name>/`:

```
services/<service-name>/
├── src/
│   ├── index.js              ← Express app bootstrap + graceful shutdown
│   ├── app.js                ← Express app factory (testable, no listen())
│   ├── routes/
│   │   └── health.js         ← GET /healthz → { status: 'ok', service: '<name>' }
│   ├── controllers/          ← (empty, ready for feature routes)
│   ├── services/             ← (empty, business logic goes here)
│   ├── middleware/
│   │   ├── authenticate.js   ← JWT RS256 verify, attach req.user + req.tenantId
│   │   ├── authorize.js      ← RBAC role check factory
│   │   ├── validate.js       ← Zod schema validation middleware
│   │   ├── audit-log.js      ← Writes to audit_logs table on mutation routes
│   │   └── error-handler.js  ← Global Express error handler
│   ├── db/
│   │   └── client.js         ← Knex instance (reads DATABASE_URL from env)
│   └── utils/
│       ├── AppError.js       ← Custom error class
│       ├── logger.js         ← Pino logger instance
│       └── response.js       ← ok(), created(), noContent() helpers
├── Dockerfile                ← Multi-stage: base, dev, prod
├── package.json              ← ES modules, scripts: start, dev, test
├── .env.example              ← All required env vars documented, no values
└── README.md                 ← Service purpose, endpoints, local run instructions
```

Rules:
- ES Modules (`"type": "module"`)
- Pino logger, not console.log
- AppError for all thrown errors
- Graceful shutdown: listen for SIGTERM, close DB connections, then exit
- Health route returns 200 when DB is reachable, 503 if not
- All env vars documented in .env.example with a comment explaining each
- Add the service to `docker-compose.yml` with correct port and env_file

After scaffolding, list what the user needs to implement next (controllers, services, routes for their feature).
