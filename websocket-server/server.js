/**
 * High-Performance Telemetry WebSocket Server & Distribution Pipeline
 * Author: Muhammad Abdullah (Backend & Agentic AI)
 * 
 * Intercepts physical AI telemetry from producers/mock generators, executes continuous running variance matrix math,
 * and streams real-time arbitration alerts to dashboard consumers with sub-4ms processing.
 */

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const { ArbitrationEngine } = require('./arbitrationEngine');

// ─── Configuration ───────────────────────────────────────────────────────────
const PORT = process.env.WS_PORT || process.env.PORT || 8080;
const DRIFT_THRESHOLD = parseFloat(process.env.DRIFT_THRESHOLD) || 4.0;

// Initialize Express App & HTTP Server
const app = express();
app.use(express.json());

// Enable CORS for frontend Dashboard integration (Muhammad Ammar's React dashboard)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize Mathematical Arbitration Engine
const arbitrationEngine = new ArbitrationEngine({
  driftThreshold: DRIFT_THRESHOLD,
  windowSize: 30
});

// Client tracking sets
const clients = new Set();
let messageCount = 0;

// ─── REST Endpoints ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Multi-Modal Consensus Telemetry Core Engine',
    port: PORT,
    connectedClients: clients.size,
    uptimeSeconds: Math.floor(process.uptime()),
    engineStats: arbitrationEngine.getStats()
  });
});

app.get('/api/stats', (req, res) => {
  res.json(arbitrationEngine.getStats());
});

app.post('/api/config', (req, res) => {
  const { driftThreshold } = req.body;
  if (typeof driftThreshold === 'number' && driftThreshold > 0) {
    arbitrationEngine.driftThreshold = driftThreshold;
    console.log(`[WebSocket Server] Dynamic Drift Threshold updated to: ${driftThreshold}`);
    return res.json({ success: true, newThreshold: driftThreshold });
  }
  res.status(400).json({ error: 'Invalid driftThreshold parameter' });
});

// ─── WebSocket Event Handling ────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  clients.add(ws);
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket Server] New client connected from ${clientIp}. Total connected: ${clients.size}`);

  // Send initial welcome & engine status frame
  ws.send(JSON.stringify({
    type: 'SYSTEM_CONNECTED',
    message: 'Connected to Multi-Modal Consensus Telemetry Core Pipeline',
    timestamp: Date.now(),
    config: {
      driftThreshold: arbitrationEngine.driftThreshold,
      targetLatencyMs: 4.0
    }
  }));

  ws.on('message', (rawMessage) => {
    try {
      const messageStr = rawMessage.toString();
      const payload = JSON.parse(messageStr);

      // Handle Ping / Heartbeat
      if (payload.type === 'PING') {
        return ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }

      // Check if message is a Telemetry Reading
      // Supports raw reading or wrapped object { type: 'TELEMETRY_DATA', data: reading }
      const reading = payload.data || payload;

      if (!reading.nodeId || !reading.sensorType || !reading.coordinates) {
        console.warn('[WebSocket Server] Received malformed message:', payload);
        return;
      }

      messageCount++;

      // Execute continuous running variance matrix math & arbitration
      const arbitrationPacket = arbitrationEngine.processReading(reading);

      // Broadcast telemetry + continuous variance matrix + arbitration alerts to ALL connected dashboard clients
      broadcast(arbitrationPacket);

      // Optional console logging for server metrics
      if (arbitrationPacket.arbitrationResult && arbitrationPacket.arbitrationResult.disagreementDetected) {
        console.log(`[DISAGREEMENT ANOMALY DETECTED] Node: ${reading.nodeId} | Delta: ${arbitrationPacket.arbitrationResult.euclideanDistance} | Latency: ${arbitrationPacket.executionLatencyMs}ms`);
      }

    } catch (err) {
      console.error('[WebSocket Server] Error parsing message:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WebSocket Server] Client disconnected. Remaining connected: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket Server] Client socket error:', err.message);
    clients.delete(ws);
  });
});

/**
 * Broadcast payload to all connected active WebSocket clients
 */
function broadcast(data) {
  const messageStr = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

// Start Server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Multi-Modal Telemetry Core WebSocket Server Running`);
    console.log(`📡 Listening on: ws://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`⚡ Target Latency: < 4ms (Mathematical Arbitration Layer Active)`);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server, wss, arbitrationEngine, broadcast };
