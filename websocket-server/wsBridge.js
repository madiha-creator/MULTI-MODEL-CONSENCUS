/**
 * WebSocket Telemetry Bridge Client
 * Reads JSON lines from stdin (emitted by Madeeha's mockGenerator.js) and forwards them in real-time
 * to the Telemetry Core Engine WebSocket server on port 8080.
 * 
 * Usage:
 * node mock-generator/mockGenerator.js | node websocket-server/wsBridge.js
 */

const readline = require('readline');
const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080';
let ws = null;
let isConnected = false;
const queue = [];

function connect() {
  process.stderr.write(`[WS Bridge] Connecting to WebSocket Server at ${WS_URL}...\n`);
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    process.stderr.write('✅ [WS Bridge] Connected to WebSocket Server successfully!\n');
    isConnected = true;

    // Flush queued messages
    while (queue.length > 0 && isConnected) {
      const msg = queue.shift();
      ws.send(msg);
    }
  });

  ws.on('close', () => {
    process.stderr.write('⚠️ [WS Bridge] WebSocket connection closed. Reconnecting in 2s...\n');
    isConnected = false;
    setTimeout(connect, 2000);
  });

  ws.on('error', (err) => {
    process.stderr.write(`❌ [WS Bridge] Connection error: ${err.message}\n`);
  });
}

// Start stdin line reader
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed) {
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(trimmed);
    } else {
      queue.push(trimmed);
      if (queue.length > 500) queue.shift(); // Drop oldest if queue overflows
    }
  }
});

connect();
