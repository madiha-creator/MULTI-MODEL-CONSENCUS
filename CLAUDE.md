# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Multi-Modal Consensus Broker — an edge-telemetry system that arbitrates disagreement between parallel AI sensor modalities (computer vision "camera" vs. "depth"). It compares coordinate streams from the two modalities and flags spatial divergence ("drift") anomalies in real time, targeting sub-4ms arbitration latency. Built for a hackathon (AI Infra Summit); the codebase is a set of loosely-coupled modules owned by different team members, wired together by a shared telemetry schema.

## Commands

```bash
npm install                # install deps (ws, express, mongoose)

# Legacy standalone pipeline (stdin/stdout, no server) — quick local test
npm run mock:pipe          # mockGenerator | broker: simulate sensors, detect drift, log to console
npm run mock               # run generator alone (emits JSON lines to stdout)
npm run broker             # run broker alone (reads JSON lines from stdin)

# WebSocket pipeline (the real integration path)
npm run server             # start Telemetry Core Engine on ws://localhost:8080 (+ HTTP :8080)
npm run ws:pipe            # mockGenerator | wsBridge: pipe simulated data into the running server
npm run test:ws            # integration test against a RUNNING server (start `npm run server` first)

# Persistence & deployment (database/, Muhammad Usman)
npm run db:up              # start local MongoDB via docker compose
npm run test:db            # smoke-test the persistence layer (needs MongoDB running)
npm run docker:up          # build & run full stack (server + MongoDB) in containers
```

The server connects to MongoDB via `MONGODB_URI` (default local; set an Atlas URI for prod). If the DB is unreachable it runs in **degraded mode** — the pipeline keeps serving and buffers writes, it just doesn't persist until the DB recovers. Local runs load `.env` via Node's `--env-file-if-exists`; copy `.env.example` to `.env`.

There is no unit test runner, linter, or build step configured. `test:ws` is an end-to-end script (`websocket-server/testClient.js`) that requires the server to already be listening — it is not run via `npm test`. To run it: start `npm run server` in one terminal, then `npm run test:ws` in another.

Env vars for the server: `WS_PORT`/`PORT` (default 8080), `DRIFT_THRESHOLD` (default 4.0). The bridge honors `WS_URL` (default `ws://localhost:8080`).

## Architecture

Data flows producer → transport → arbitration → consumers. There are **two parallel, independent implementations** of this flow — do not confuse them:

1. **Legacy pipe path** (`mock-generator/broker.js`): reads JSON lines from stdin, does simple per-axis absolute-delta drift detection, logs to console. Self-contained, no server. Kept as a standalone dev harness.
2. **WebSocket path** (`websocket-server/`): the real system. `wsBridge.js` forwards the generator's stdout lines into `server.js` over WebSocket; `server.js` runs each reading through `arbitrationEngine.js` and broadcasts an enriched result to all connected clients (e.g. the dashboard).

The two paths share the **telemetry schema** but implement drift detection differently (see below). When changing detection logic, know which path you're in.

### The telemetry schema (the contract between all modules)

Every reading is one JSON object; this shape is the glue across `mock-generator`, `websocket-server`, `automation`, and the future `database`/`dashboard`:

```json
{
  "nodeId": "edge-node-01",
  "sensorType": "camera",            // or "depth"
  "sequenceNo": 1042,
  "timestamp": 1726308737000,         // Unix epoch ms — camera & depth for the same frame share it
  "coordinates": { "x": 12.45, "y": 3.14, "z": 0.88 },
  "confidence": 0.98                  // drops during drift
}
```

Cross-modality alignment is done by matching **camera and depth readings that share the same `timestamp`** for a given `nodeId`. The generator emits both modalities with an identical `Date.now()` timestamp each tick, which is what makes this join work. Any producer must preserve that invariant.

### Arbitration engine (`websocket-server/arbitrationEngine.js`)

The core math, isolated from transport so it can be unit-tested and reused. Two classes:

- `RunningVarianceCalculator` — per-(node, sensor) sliding window (default 30) computing running mean, per-axis sample variance/stdDev, and a 3×3 spatial covariance matrix.
- `ArbitrationEngine` — owns one calculator per (node, sensor) and a `syncCache` keyed by `nodeId → timestamp → sensorType`. On each reading it updates stats, caches the frame, and — once both `camera` and `depth` exist for that timestamp — calls `arbitratePair`, which computes the Euclidean distance between the two coordinate vectors and flags `disagreementDetected` when it exceeds `driftThreshold`. It also derives a normalized z-score divergence using pooled cross-modality stdDev.

`processReading` returns a `TELEMETRY_ARBITRATED` packet (stats + arbitration result + `executionLatencyMs` + `underTargetLatency`). This packet shape is what dashboard consumers depend on.

Note the **two detection algorithms differ**: the legacy broker flags when per-axis absolute delta on x OR y exceeds the threshold; the engine flags on 3D Euclidean distance. Same threshold value (4.0), different geometry.

### Module ownership (per README) — where things live

- `mock-generator/` — simulated sensor data + legacy broker/queue
- `websocket-server/` — the live telemetry pipeline and arbitration engine
- `database/` — Mongoose/MongoDB persistence + deployment (implemented). `db.js` (env-driven connection, graceful degradation), `models/` (`TelemetryReading` high-volume w/ TTL, `DriftEvent` permanent audit trail), `persistence.js` (buffered batched writer so the sub-4ms hot path never blocks on Mongo), `queries.js` + REST endpoints (`/api/summary`, `/api/drift-events`, `/api/readings`). Wired into `server.js` via `database.persistence.ingest(packet)`. Deployment: root `Dockerfile` + `docker-compose.yml` (server + MongoDB). See `database/README.md`.
- `dashboard/` — React canvas dashboard (not yet scaffolded; `npm run dashboard` is a placeholder)
- `eval/` — evaluation/guardrails/test data (not yet implemented)
- `automation/` — `drift-canvas-prototype.html`, a standalone browser Canvas visualization of drift (open directly, no server). `automation/archive-specuaudio/` is abandoned prompt-engineering work from a prior project direction — reference only, out of scope.

`dashboard/` and `eval/` are still placeholders. The server sets up CORS and a `broadcast()` fan-out for the dashboard, and now persists every arbitrated frame to MongoDB via the `database/` module (with drift anomalies recorded separately).
