// Node Broker Module for Multi-Modal Consensus Broker
// Receives mock telemetry data and processes/forwards in order
// Designed to be later replaced with WebSocket pipeline

const readline = require('readline');

// Configuration
const CONFIG = {
  // In-memory queue for pending messages
  maxQueueSize: 10000, // Safety limit
  // Whether to enable console logging of processed data
  logProcessed: true,
  // Whether to enable consensus checking (compare vision vs depth)
  enableConsensusCheck: true
};

// Simple in-memory queue
class MessageQueue {
  constructor(maxSize = CONFIG.maxQueueSize) {
    this.queue = [];
    this.maxSize = maxSize;
    this.droppedCount = 0;
  }

  // Add message to queue (FIFO)
  enqueue(message) {
    if (this.queue.length >= this.maxSize) {
      this.droppedCount++;
      return false; // Queue overflow
    }
    this.queue.push(message);
    return true;
  }

  // Remove and return oldest message
  dequeue() {
    if (this.isEmpty()) return null;
    return this.queue.shift();
  }

  // Check if queue is empty
  isEmpty() {
    return this.queue.length === 0;
  }

  // Get current queue size
  size() {
    return this.queue.length;
  }

  // Get number of dropped messages
  getDroppedCount() {
    return this.droppedCount;
  }
}

// Broker class - coordinates message processing
class Broker {
  constructor() {
    this.queue = new MessageQueue();
    this.messageCount = 0;
    this.driftEvents = []; // Track detected drift events
    this.visionMessagesByTimestamp = {}; // Cache vision messages by timestamp for alignment
  }

  // Process incoming raw JSON message
  processMessage(data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      // Validate required fields
      if (!message.deviceId || !message.source || !message.timestamp) {
        console.warn('Broker: Received malformed message, skipping:', message);
        return false;
      }

      // Add to queue
      if (!this.queue.enqueue(message)) {
        console.error('Broker: Queue overflow, message dropped');
        return false;
      }

      // Process all queued messages in order
      this.processQueue();
      return true;
    } catch (error) {
      console.error('Broker: Error processing message:', error.message);
      return false;
    }
  }

  // Process all messages currently in queue
  processQueue() {
    while (!this.queue.isEmpty()) {
      const message = this.queue.dequeue();
      this.messageCount++;

      // Cache vision messages by timestamp for cross-modality comparison
      if (message.source === 'vision') {
        this.visionMessagesByTimestamp[message.timestamp] = message;
      }

      // Log processed message
      if (CONFIG.logProcessed) {
        console.log(`[Broker] #${this.messageCount} | ${message.source} | seq=${message.sequence} | x=${message.x.toFixed(2)}, y=${message.y.toFixed(2)}, z=${message.z.toFixed(2)}`);
      }

      // Check for consensus drift between modalities
      if (CONFIG.enableConsensusCheck && message.source === 'depth') {
        this.checkConsensus(message);
      }
    }
  }

  // Compare vision and depth readings to detect divergence
  checkConsensus(depthMessage) {
    // Look up the vision reading with the same timestamp
    const visionMessage = this.visionMessagesByTimestamp[depthMessage.timestamp];
    if (!visionMessage) return;

    const threshold = 4.0; // Coordinate difference threshold for drift detection
    const dx = Math.abs(visionMessage.x - depthMessage.x);
    const dy = Math.abs(visionMessage.y - depthMessage.y);

    if (dx > threshold || dy > threshold) {
      const driftEvent = {
        timestamp: depthMessage.timestamp,
        deviceId: visionMessage.deviceId,
        visionX: visionMessage.x,
        visionY: visionMessage.y,
        depthX: depthMessage.x,
        depthY: depthMessage.y,
        deltaX: dx.toFixed(3),
        deltaY: dy.toFixed(3),
        threshold: threshold,
        detectedAt: new Date().toISOString()
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

// Create a singleton broker instance
const broker = new Broker();

// Function to read from stdin (pipe)
function startStdinReader() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false // Important: don't echo input, just process lines
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

  // Handle errors
  rl.on('error', (err) => {
    console.error('Broker: stdin error:', err);
  });
}

// Print final statistics
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

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    printFinalStats();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    printFinalStats();
    process.exit(0);
  });
}

// Export for use as a module (e.g., to plug into WebSocket server later)
module.exports = { Broker, MessageQueue, broker };