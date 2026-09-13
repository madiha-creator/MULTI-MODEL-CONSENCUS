# Multi-Modal Consensus Broker

Edge telemetry system that acts as a sensor disagreement arbitrator — it compares outputs from parallel AI modules (e.g., computer vision vs. depth sensor) and detects data divergence anomalies before a runtime trigger fires.

**Hackathon:** AI Infra Summit
**Deadline:** September 16, 2026

## Folder Structure

```
multimodal-consensus-broker/
├── mock-generator/     ← Madeeha (mock sensor data + broker/queue logic)
├── websocket-server/   ← Muhammad Abdullah (telemetry WebSocket pipeline)
├── database/           ← Muhammad Usman (Mongoose/MongoDB schemas, deployment)
├── dashboard/          ← Muhammad Ammar (React canvas dashboard)
├── eval/               ← Munizah (evaluation, guardrails, test data)
├── automation/         ← Malahil Ghauri (Claude-driven scaffolding, UI polish)
├── package.json
├── .gitignore
└── README.md
```

## Setup

1. Install [Node.js](https://nodejs.org) (LTS version).
2. Clone the repo and install dependencies:
   ```bash
   git clone <repo-url>
   cd multimodal-consensus-broker
   npm install
   ```

## Running the Mock Generator + Broker (standalone test)

```bash
npm run mock:pipe
```
This pipes simulated vision/depth sensor data into the broker, which detects and logs drift (disagreement) events.

## Next Steps (Integration)

- Once `websocket-server` is ready, `mockGenerator.js` will send data via `ws.send()` instead of `process.stdout.write()`.
- `broker.js` will receive data via `ws.on('message', ...)` instead of reading from stdin.
- Once `database` schemas are ready, the broker will persist processed telemetry and drift events to MongoDB.
- `dashboard` will visualize live data and drift events on an HTML/React canvas.

## Team

| Member | Role |
|---|---|
| Muhammad Ammar | Full Stack & Agentic AI |
| Muhammad Abdullah | Backend & Agentic AI |
| Muhammad Usman | Backend, Agentic AI & Deployment |
| Madeeha | Agents & Backend |
| Munizah | LLM Testing/Eval & Prompt Content |
| Malahil Ghauri | System UI & Claude Automation |
