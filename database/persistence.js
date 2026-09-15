/**
 * Persistence Service — high-throughput buffered writer & routing layer
 * Author: Muhammad Usman (Data Persistence & Routing)
 *
 * Sits between the WebSocket arbitration pipeline and MongoDB. Rather than issuing
 * one round-trip per reading (which would throttle the sub-4ms hot path), readings
 * are buffered in memory and flushed in bulk via insertMany() on a timer or when
 * the batch fills. Drift anomalies are rarer and higher-value, so they are batched
 * on a short flush interval too but never dropped by backpressure.
 *
 * All writes are fire-and-forget from the caller's perspective: ingest() never
 * awaits Mongo, so the telemetry hot path stays fast and stays alive even if the
 * database is slow or down (see database/db.js graceful-degradation contract).
 */

const db = require('./db');
const TelemetryReading = require('./models/TelemetryReading');
const DriftEvent = require('./models/DriftEvent');

const BATCH_SIZE = parseInt(process.env.MONGO_BATCH_SIZE, 10) || 100;
const FLUSH_INTERVAL_MS = parseInt(process.env.MONGO_FLUSH_MS, 10) || 1000;
// Cap the in-memory buffer so a prolonged DB outage can't exhaust heap.
const MAX_BUFFER = parseInt(process.env.MONGO_MAX_BUFFER, 10) || 10000;

class PersistenceService {
  constructor() {
    this.readingBuffer = [];
    this.driftBuffer = [];
    this.flushTimer = null;
    this.stats = {
      readingsPersisted: 0,
      driftEventsPersisted: 0,
      readingsDropped: 0, // buffer overflow while DB unavailable
      flushErrors: 0,
      lastFlushAt: null,
    };
  }

  start() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    // Don't let the flush timer keep the process alive on its own.
    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  /**
   * Ingest a TELEMETRY_ARBITRATED packet from the arbitration engine.
   * Non-blocking: appends to buffers and returns immediately.
   */
  ingest(packet) {
    if (!packet) return;

    this._push(this.readingBuffer, this._toReadingDoc(packet));

    // Persist an anomaly document only when a genuine disagreement fired.
    const ar = packet.arbitrationResult;
    if (ar && ar.disagreementDetected) {
      this._push(this.driftBuffer, this._toDriftDoc(packet, ar));
    }

    // Opportunistic flush when a batch is ready (don't wait for the timer).
    if (this.readingBuffer.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  _push(buffer, doc) {
    if (buffer.length >= MAX_BUFFER) {
      buffer.shift(); // drop oldest under sustained backpressure
      this.stats.readingsDropped++;
    }
    buffer.push(doc);
  }

  _toReadingDoc(p) {
    return {
      nodeId: p.nodeId,
      sensorType: p.sensorType,
      sequenceNo: p.sequenceNo,
      timestamp: p.timestamp,
      coordinates: p.reading && p.reading.coordinates,
      confidence: p.reading && p.reading.confidence,
      sensorStats: p.sensorStats && {
        mean: p.sensorStats.mean,
        variance: p.sensorStats.variance,
        stdDev: p.sensorStats.stdDev,
      },
      executionLatencyMs: p.executionLatencyMs,
      underTargetLatency: p.underTargetLatency,
      ingestedAt: new Date(),
    };
  }

  _toDriftDoc(p, ar) {
    return {
      nodeId: ar.nodeId,
      timestamp: ar.timestamp,
      cameraCoordinates: ar.cameraCoordinates,
      depthCoordinates: ar.depthCoordinates,
      deltaVector: ar.deltaVector,
      euclideanDistance: ar.euclideanDistance,
      divergenceScore: ar.divergenceScore,
      threshold: ar.threshold,
      status: ar.status,
      executionLatencyMs: p.executionLatencyMs,
      detectedAt: new Date(),
    };
  }

  /**
   * Flush buffered docs to MongoDB. Safe to call any time; no-ops when the DB is
   * disconnected (buffers are retained, capped by MAX_BUFFER, and retried later).
   */
  async flush() {
    if (!db.connected()) return;
    if (this.readingBuffer.length === 0 && this.driftBuffer.length === 0) return;

    const readings = this.readingBuffer;
    const drifts = this.driftBuffer;
    this.readingBuffer = [];
    this.driftBuffer = [];

    try {
      const tasks = [];
      if (readings.length) {
        // ordered:false → one bad doc doesn't abort the whole batch.
        tasks.push(
          TelemetryReading.insertMany(readings, { ordered: false }).then(() => {
            this.stats.readingsPersisted += readings.length;
          })
        );
      }
      if (drifts.length) {
        tasks.push(
          DriftEvent.insertMany(drifts, { ordered: false }).then(() => {
            this.stats.driftEventsPersisted += drifts.length;
          })
        );
      }
      await Promise.all(tasks);
      this.stats.lastFlushAt = new Date().toISOString();
    } catch (err) {
      this.stats.flushErrors++;
      // Re-queue on failure so nothing is silently lost (bounded by MAX_BUFFER).
      this.readingBuffer = readings.concat(this.readingBuffer).slice(-MAX_BUFFER);
      this.driftBuffer = drifts.concat(this.driftBuffer).slice(-MAX_BUFFER);
      console.error('[Persistence] Flush failed, re-queued batch:', err.message);
    }
  }

  getStats() {
    return {
      ...this.stats,
      pendingReadings: this.readingBuffer.length,
      pendingDriftEvents: this.driftBuffer.length,
      dbConnected: db.connected(),
    };
  }

  /** Flush remaining buffers and stop the timer (graceful shutdown). */
  async stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

// Singleton — one buffered writer shared across the server process.
module.exports = new PersistenceService();
