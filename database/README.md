# Database Module — Data Persistence & Routing + Deployment

**Owner:** Muhammad Usman (Backend, Agentic AI & Deployment)

Binds high-throughput Mongoose/MongoDB schemas to the telemetry pipeline and
provides the deployment/infrastructure layer. Works identically against a local
Docker MongoDB (dev) and MongoDB Atlas (prod) — the only difference is the
`MONGODB_URI` env var.

## Layout

| File | Purpose |
|---|---|
| `db.js` | Env-driven connection with pooling + **graceful degradation** (server keeps running if the DB is down). |
| `models/TelemetryReading.js` | High-volume per-reading collection; TTL-expired after 24h (configurable). |
| `models/DriftEvent.js` | Low-volume, permanent audit trail of disagreement anomalies. |
| `persistence.js` | Buffered, batched writer — `insertMany` on a timer / when full, so the sub-4ms hot path never blocks on Mongo. |
| `queries.js` | Read-side queries powering the REST endpoints + dashboard history. |
| `index.js` | Public entrypoint (`connect`, `persistence`, `queries`, `models`). |
| `testDb.js` | Standalone smoke test (`npm run test:db`). |

## How it plugs in

`websocket-server/server.js` calls, on startup:

```js
const database = require('../database');
await database.connect();            // non-fatal if DB unreachable
database.persistence.start();        // start the buffered flush timer
```

...and per arbitrated frame:

```js
database.persistence.ingest(arbitrationPacket);  // non-blocking
```

Every `TELEMETRY_ARBITRATED` packet becomes one `TelemetryReading`; packets whose
`arbitrationResult.disagreementDetected` is true additionally write one
`DriftEvent`.

## REST endpoints (served by the WebSocket server)

- `GET /health` — includes `dbConnected`, resource usage, engine + persistence stats
- `GET /api/summary` — total readings, total drift events, nodes seen
- `GET /api/drift-events?nodeId=&limit=` — recent anomalies, newest first
- `GET /api/readings?nodeId=&sensorType=&limit=` — recent readings

## Running

```bash
# 1. Local MongoDB via Docker
npm run db:up            # docker compose up -d mongo

# 2. Configure (optional — sane defaults if omitted)
cp .env.example .env     # set MONGODB_URI (local or Atlas)

# 3. Smoke-test the persistence layer
npm run test:db

# 4. Run the server with persistence
npm run server

# Full stack (server + MongoDB) in containers
npm run docker:up        # docker compose up --build
```

## Deployment

- `Dockerfile` — production image (node:22-alpine, non-root, healthcheck).
- `docker-compose.yml` — server + MongoDB with a persistent volume.
- For **Atlas/cloud**: set `MONGODB_URI` to the Atlas string and run only the
  `server` service (`docker compose up server`); no local Mongo container needed.

## Configuration (env)

See `.env.example`. Key vars: `MONGODB_URI`, `MONGO_MAX_POOL`, `MONGO_BATCH_SIZE`,
`MONGO_FLUSH_MS`, `MONGO_MAX_BUFFER`, `MONGO_READING_TTL_SECONDS`.
