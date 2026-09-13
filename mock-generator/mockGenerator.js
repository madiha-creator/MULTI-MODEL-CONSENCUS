// Mock Generator for Multi-Modal Consensus Broker
// Simulates two sensor devices (vision and depth) generating coordinate data
// with occasional drift to simulate disagreement events

// Configuration
const CONFIG = {
  intervalMs: 1000, // Emit data every second
  basePosition: {
    // Simulated object moving in a pattern over time
    // Updates every interval based on elapsed time
    get: (timestampMs) => {
      const t = timestampMs / 1000; // Time in seconds
      // Circular motion for more interesting data
      return {
        x: 50 + 30 * Math.sin(t * 0.1), // Radius 30, slow oscillation
        y: 50 + 30 * Math.cos(t * 0.15), // Different frequency for y
        z: 0
      };
    }
  },
  drift: {
    probabilityPerSecond: 0.2, // 20% chance each second to activate drift
    durationSeconds: 3, // How long drift lasts when activated
    magnitude: 5.0 // Units of drift added to coordinates
  },
  noise: {
    // Gaussian noise parameters (approximated)
    stdDev: 0.3
  }
};

// State tracking
let state = {
  lastDriftActivation: 0, // Timestamp when drift was last activated
  driftActiveFor: null, // 'vision', 'depth', or null
  driftEndTime: 0, // When current drift period ends
  sequence: {
    vision: 0,
    depth: 0
  }
};

// Helper: generate Gaussian noise (Box-Muller transform)
function gaussianNoise(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Avoid log(0)
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev + mean;
}

// Helper: update drift state based on time
function updateDriftState(now) {
  // Check if current drift period has ended
  if (state.driftActiveFor && now >= state.driftEndTime) {
    state.driftActiveFor = null;
  }

  // Check if we should activate a new drift period
  if (!state.driftActiveFor &&
      now - state.lastDriftActivation > CONFIG.drift.probabilityPerSecond * 1000) {
    // Randomly decide to activate drift
    if (Math.random() < CONFIG.drift.probabilityPerSecond) {
      state.driftActiveFor = Math.random() < 0.5 ? 'vision' : 'depth';
      state.driftEndTime = now + CONFIG.drift.durationSeconds * 1000;
      state.lastDriftActivation = now;
    }
  }
}

// Generate a single sensor reading
function generateReading(source, timestampMs) {
  const base = CONFIG.basePosition.get(timestampMs);
  const noiseX = gaussianNoise(0, CONFIG.noise.stdDev);
  const noiseY = gaussianNoise(0, CONFIG.noise.stdDev);

  let driftOffset = 0;
  if (state.driftActiveFor === source) {
    // Apply drift with random direction
    driftOffset = (Math.random() < 0.5 ? -1 : 1) * CONFIG.drift.magnitude;
  }

  return {
    deviceId: "obj_01", // Same object ID for both modalities
    source: source,
    timestamp: new Date(timestampMs).toISOString(),
    x: base.x + noiseX + driftOffset,
    y: base.y + noiseY,
    z: 0,
    sequence: state.sequence[source]++
  };
}

// Main generation loop
function startMockGenerator() {
  // Info logs go to stderr so stdout stays clean JSON for downstream consumers
  process.stderr.write('Starting multimodal telemetry mock generator...\n');
  process.stderr.write('Simulating vision and depth sensors for object obj_01\n');
  process.stderr.write('Emitting JSON data every ' + CONFIG.intervalMs + ' ms\n');
  process.stderr.write('Press Ctrl+C to stop\n\n');

  let lastTimestamp = Date.now();

  const interval = setInterval(() => {
    const now = Date.now();

    // Update drift state
    updateDriftState(now);

    // Generate readings for both modalities
    const visionReading = generateReading('vision', now);
    const depthReading = generateReading('depth', now);

    // Output as JSON lines (one per reading)
    process.stdout.write(JSON.stringify(visionReading) + '\n');
    process.stdout.write(JSON.stringify(depthReading) + '\n');

    lastTimestamp = now;
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

  // Handle graceful shutdown
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