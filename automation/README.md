# Automation Module — System UI & Claude Automation

**Owner:** Malahil Ghauri
**Role:** Prompt-Driven Automation + UI Polish & Visual Anchors

## What's in this folder

- `drift-canvas-prototype.html` — Standalone HTML/JS Canvas prototype that 
  visualizes sensor disagreement (drift) between vision and depth sensors 
  across 4 edge nodes. Includes a manual drift-injection slider and a live 
  summary panel (agreement count, drift count, average disagreement).

- `archive-specuaudio/` — Earlier prompt engineering work (lookahead routing 
  prompt, JSON schema, few-shot examples, UI style guide) done for an earlier 
  project direction. Kept for reference; not part of the final Multi-Modal 
  Consensus Broker scope.

## How to view the prototype

1. Open `drift-canvas-prototype.html` directly in any browser (double-click 
   the file, no server needed).
2. Move the slider labeled "Manual Drift Injection" to simulate increasing 
   sensor disagreement.
3. Watch the connecting lines between vision (cyan) and depth (purple) nodes 
   change color: green (agreement) → amber (moderate drift) → red (high drift).
4. The summary cards above the canvas update live with node counts and 
   average disagreement.

## How this fits into the final dashboard

This prototype is a **visual reference implementation** for the drift-
visualization logic described in the project blueprint (Day 3-4: "manual 
drift controls" and "real-time vector visualization lines"). 

Once the React dashboard (`dashboard/` folder, owned by Ammar) is scaffolded, 
the core drawing logic (`draw()` function, disagreement calculation, and 
color-threshold rules) will be adapted into a React component that consumes 
live data from the WebSocket layer instead of the simulated slider values 
used here.

## Data shape reference

Node structure follows the telemetry schema confirmed by Muhammad Abdullah:

{
  "nodeId": "edge-node-01",
  "sensorType": "camera",
  "sequenceNo": 1042,
  "timestamp": 1726308737000,
  "coordinates": { "x": 12.45, "y": 3.14, "z": 0.88 },
  "confidence": 0.98
}

## Status: Live-tested (16 Sep)

Successfully tested against the running WebSocket server (`npm run server`) 
and live mock data (`npm run ws:pipe`). Confirmed:
- Real-time connection to ws://localhost:8080
- Correct parsing of TELEMETRY_ARBITRATED packets
- Sub-1ms arbitration latency observed (target was <4ms)
- Node agreement/drift counters update live from real arbitration results
