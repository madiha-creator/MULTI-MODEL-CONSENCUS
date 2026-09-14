// Node Broker Module for Multi-Modal Consensus Broker
// Receives mock telemetry data and processes/forwards in order
// Designed to be later replaced with WebSocket pipeline
//
// Expected input format (JSON lines on stdin):
// {
//   "nodeId": "edge-node-01",
//   "sensorType": "camera",
//   "sequenceNo": 1042,
//   "timestamp": 1726308737000,
//   "coordinates": { "x": 12.45, "y": 3.14, "z": 0.88 },
//   "confidence": 0.98
// }

const readline = require('readline');

// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  maxQueueSize: 10000,
  logProcessed: true,
  enableConsensusCheck: true,

  // Drift detection: flag when coordinate delta between modalities exceeds this
  driftThreshold: 4.0
};

// ─── Simple in-memory FIFO queue ─────────────────────────────────────────────
class MessageQueue {
  constructor(maxSize = CONFIG.maxQueueSize) {
    this.queue = [];
    this.maxSize = maxSize;
    this.droppedCount = 0;
  }

  enqueue(message) {
    if (this.queue.length >= this.maxSize) {
      this.droppedCount++;
      return false;
    }
    this.queue.push(message);
    return true;
  }

  dequeue() {
    if (this.isEmpty()) return null;
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  size() {
    return this.queue.length;
  }

  getDroppedCount() {
    return this.droppedCount;
  }
}

// ─── Broker: coordinates message processing and consensus checks ─────────────
class Broker {
  constructor() {
    this.queue = new MessageQueue();
    this.messageCount = 0;
    this.driftEvents = [];
    this.cameraMessagesByTimestamp = {}; // Cache camera readings for alignment
  }

  // Process an incoming raw JSON message (string or object)
  processMessage(data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      // Validate required fields
      if (!message.nodeId || !message.sensorType || !message.timestamp ||
          !message.coordinates || !message.sequenceNo) {
        console.warn('Broker: Received malformed message, skipping:', message);
        return false;
      }

      // Guard: coordinates must have x, y, z
      const c = message.coordinates;
      if (typeof c.x !== 'number' || typeof c.y !== 'number' || typeof c.z !== 'number') {
        console.warn('Broker: Message coordinates incomplete, skipping:', message);
        return false;
      }

      if (!this.queue.enqueue(message)) {
        console.error('Broker: Queue overflow, message dropped');
        return false;
      }

      this.processQueue();
      return true;
    } catch (error) {
      console.error('Broker: Error processing message:', error.message);
      return false;
    }
  }

  // Process all messages currently in queue (FIFO)
  processQueue() {
    while (!this.queue.isEmpty()) {
      const message = this.queue.dequeue();
      this.messageCount++;

      // Cache camera messages by timestamp for cross-modality comparison
      if (message.sensorType === 'camera') {
        this.cameraMessagesByTimestamp[message.timestamp] = message;
      }

      // Log processed message
      if (CONFIG.logProcessed) {
        const c = message.coordinates;
        console.log(`[Broker] #${this.messageCount} | ${message.sensorType} | seq=${message.sequenceNo} | x=${c.x.toFixed(2)}, y=${c.y.toFixed(2)}, z=${c.z.toFixed(2)} | conf=${message.confidence}`);
      }

      // Check for consensus drift between modalities
      if (CONFIG.enableConsensusCheck && message.sensorType === 'depth') {
        this.checkConsensus(message);
      }
    }
  }

  // Compare camera and depth readings at the same timestamp to detect divergence
  checkConsensus(depthMessage) {
    const depthTs = depthMessage.timestamp;
    const cameraMessage = this.cameraMessagesByTimestamp[depthTs];
    if (!cameraMessage) return;

    const dx = Math.abs(cameraMessage.coordinates.x - depthMessage.coordinates.x);
    const dy = Math.abs(cameraMessage.coordinates.y - depthMessage.coordinates.y);

    if (dx > CONFIG.driftThreshold || dy > CONFIG.driftThreshold) {
      const driftEvent = {
        timestamp: depthTs,
        nodeId: cameraMessage.nodeId,
        cameraX: cameraMessage.coordinates.x,
        cameraY: cameraMessage.coordinates.y,
        depthX: depthMessage.coordinates.x,
        depthY: depthMessage.coordinates.y,
        deltaX: dx.toFixed(3),
        deltaY: dy.toFixed(3),
        threshold: CONFIG.driftThreshold,
        detectedAt: Date.now()
      };
      this.driftEvents.push(driftEvent);
      console.log(`\n*** DRIFT DETECTED *** ${JSON.stringify(driftEvent)}`);
      console.log('***********************\n');
    }
  }

  // Get summary statistics
  getStats() {
    return {
      totalProcessed: this.messageCount,
      queueSize: this.queue.size(),
      driftEventsDetected: this.driftEvents.length,
      droppedMessages: this.queue.getDroppedCount()
    };
  }
}

// ─── Singleton instance and stdin reader ─────────────────────────────────────
const broker = new Broker();

function startStdinReader() {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false // Don't echo; just process lines
  });

  process.stderr.write('Broker started. Waiting for telemetry data from stdin...\n');
  process.stderr.write('Expected input: JSON objects, one per line\n\n');

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (trimmed) {
      broker.processMessage(trimmed);
    }
  });

  rl.on('close', () => {
    process.stderr.write('\nBroker: stdin closed. Shutting down...\n');
    printFinalStats();
    process.exit(0);
  });

  rl.on('error', (err) => {
    console.error('Broker: stdin error:', err);
  });
}

function printFinalStats() {
  const stats = broker.getStats();
  console.log('\n--- Broker Final Statistics ---');
  console.log(`Total messages processed: ${stats.totalProcessed}`);
  console.log(`Drift events detected: ${stats.driftEventsDetected}`);
  console.log(`Dropped messages: ${stats.droppedMessages}`);
  console.log('--------------------------------\n');
}

// Start broker if run directly
if (require.main === module) {
  startStdinReader();

  process.on('SIGINT', () => {
    printFinalStats();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    printFinalStats();
    process.exit(0);
  });
}

module.exports = { Broker, MessageQueue, broker };