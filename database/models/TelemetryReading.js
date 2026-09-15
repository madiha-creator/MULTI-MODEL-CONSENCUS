/**
 * TelemetryReading Model — persisted arbitrated telemetry frame
 * Author: Muhammad Usman (Data Persistence & Routing)
 *
 * One document per sensor reading processed by the arbitration engine. This is
 * the HIGH-VOLUME collection (two writes per node per tick), so:
 *   - documents are lean (no per-write validation overhead beyond the schema)
 *   - a TTL index auto-expires raw readings after MONGO_READING_TTL_SECONDS
 *     (default 24h) to keep storage bounded on edge/free-tier clusters.
 * Long-lived anomaly records live in the separate DriftEvent collection.
 */

const mongoose = require('mongoose');

const READING_TTL_SECONDS =
  parseInt(process.env.MONGO_READING_TTL_SECONDS, 10) || 24 * 60 * 60;

const CoordinatesSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true },
  },
  { _id: false }
);

const TelemetryReadingSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, index: true },
    sensorType: { type: String, required: true, enum: ['camera', 'depth'] },
    sequenceNo: { type: Number, required: true },
    // Source telemetry timestamp (Unix epoch ms) — used to align modalities.
    timestamp: { type: Number, required: true },
    coordinates: { type: CoordinatesSchema, required: true },
    confidence: { type: Number },

    // Arbitration-engine enrichment (from the TELEMETRY_ARBITRATED packet).
    sensorStats: {
      mean: { x: Number, y: Number, z: Number },
      variance: { x: Number, y: Number, z: Number },
      stdDev: { x: Number, y: Number, z: Number },
    },
    executionLatencyMs: { type: Number },
    underTargetLatency: { type: Boolean },

    // Wall-clock ingestion time; drives the TTL expiry below.
    ingestedAt: { type: Date, default: Date.now },
  },
  { collection: 'telemetry_readings' }
);

// Compound index for the common "latest readings for a node" query.
TelemetryReadingSchema.index({ nodeId: 1, timestamp: -1 });
// TTL index — Mongo auto-deletes readings older than the configured window.
TelemetryReadingSchema.index({ ingestedAt: 1 }, { expireAfterSeconds: READING_TTL_SECONDS });

module.exports = mongoose.model('TelemetryReading', TelemetryReadingSchema);
