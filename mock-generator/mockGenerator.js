// Mock Generator for Multi-Modal Consensus Broker
// Simulates two sensor devices (camera and depth) generating coordinate data
// with occasional drift to simulate disagreement events
//
// Output format (JSON lines on stdout):
// {
//   "nodeId": "edge-node-01",
//   "sensorType": "camera",          // or "depth"
//   "sequenceNo": 1042,
//   "timestamp": 1726308737000,       // Unix epoch milliseconds
//   "coordinates": { "x": 12.45, "y": 3.14, "z": 0.88 },
//   "confidence": 0.98              // drops slightly during drift
// }

// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  intervalMs: 1000, // Emit data every second

  nodeId: 'edge-node-01',
  sensorTypes: ['camera', 'depth'],

  basePosition: {
    // Simulated object moving in a pattern over time
    get: (timestampMs) => {
      const t = timestampMs / 1000;
      return {
        x: 50 + 30 * Math.sin(t * 0.1),
        y: 50 + 30 * Math.cos(t * 0.15),
        z: 0
      };
    }
  },

  drift: {
    probabilityPerSecond: 0.2,   // 20% chance each second to activate drift
    durationSeconds: 3,          // How long drift lasts when activated
    magnitude: 5.0               // Units of drift added to coordinates
  },

  noise: {
    stdDev: 0.3                   // Gaussian noise standard deviation
  },

  confidence: {
    normal: 0.95,                 // Confidence under normal conditions
    min: 0.60,                    // Minimum confidence during drift
    // Confidence drops linearly as drift magnitude increases
    getMinForMagnitude: (mag) => 0.60 + 0.35 * (1 - Math.min(mag / 5.0, 1.0))
  }
};

// ─── State tracking ──────────────────────────────────────────────────────────
let state = {
  lastDriftActivation: 0,
  driftActiveFor: null, // 'camera', 'depth', or null
  driftEndTime: 0,
  sequenceNo: {
    camera: 0,
    depth: 0
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Generate Gaussian noise (Box-Muller transform)
function gaussianNoise(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev + mean;
}

// Update drift state based on current time
function updateDriftState(now) {
  if (state.driftActiveFor && now >= state.driftEndTime) {
    state.driftActiveFor = null;
  }

  if (!state.driftActiveFor &&
      now - state.lastDriftActivation > CONFIG.drift.probabilityPerSecond * 1000) {
    if (Math.random() < CONFIG.drift.probabilityPerSecond) {
      state.driftActiveFor = Math.random() < 0.5 ? 'camera' : 'depth';
      state.driftEndTime = now + CONFIG.drift.durationSeconds * 1000;
      state.lastDriftActivation = now;
    }
  }
}

// Generate a single sensor reading matching the WebSocket team's schema
function generateReading(sensorType, timestampMs) {
  const base = CONFIG.basePosition.get(timestampMs);
  const noiseX = gaussianNoise(0, CONFIG.noise.stdDev);
  const noiseY = gaussianNoise(0, CONFIG.noise.stdDev);
  const noiseZ = gaussianNoise(0, CONFIG.noise.stdDev);

  let driftOffset = 0;
  if (state.driftActiveFor === sensorType) {
    driftOffset = (Math.random() < 0.5 ? -1 : 1) * CONFIG.drift.magnitude;
  }

  // Confidence is high normally; drops during drift
  let confidence = CONFIG.confidence.normal;
  if (state.driftActiveFor === sensorType) {
    confidence = CONFIG.confidence.getMinForMagnitude(CONFIG.drift.magnitude);
  }

  return {
    nodeId: CONFIG.nodeId,
    sensorType: sensorType,
    sequenceNo: state.sequenceNo[sensorType]++,
    timestamp: timestampMs,
    coordinates: {
      x: base.x + noiseX + driftOffset,
      y: base.y + noiseY,
      z: base.z + noiseZ
    },
    confidence: parseFloat(confidence.toFixed(2))
  };
}

// ─── Main generation loop ────────────────────────────────────────────────────
function startMockGenerator() {
  // Info logs go to stderr so stdout stays clean JSON for downstream consumers
  process.stderr.write('Starting multimodal telemetry mock generator...\n');
  process.stderr.write('Simulating camera and depth sensors for node ' + CONFIG.nodeId + '\n');
  process.stderr.write('Emitting JSON data every ' + CONFIG.intervalMs + ' ms\n');
  process.stderr.write('Press Ctrl+C to stop\n\n');

  const interval = setInterval(() => {
    const now = Date.now();

    // Update drift state
    updateDriftState(now);

    // Generate readings for both modalities (same timestamp)
    const cameraReading = generateReading('camera', now);
    const depthReading = generateReading('depth', now);

    // Output as JSON lines (one per reading)
    process.stdout.write(JSON.stringify(cameraReading) + '\n');
    process.stdout.write(JSON.stringify(depthReading) + '\n');
  }, CONFIG.intervalMs);

  // Return stop function for clean shutdown
  return () => {
    clearInterval(interval);
    process.stderr.write('\nMock generator stopped.\n');
  };
}

// Start if run directly
if (require.main === module) {
  const stop = startMockGenerator();

  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stop();
    process.exit(0);
  });
}

module.exports = { startMockGenerator };