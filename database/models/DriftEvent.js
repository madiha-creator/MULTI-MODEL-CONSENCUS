/**
 * DriftEvent Model — persisted disagreement/consensus anomaly
 * Author: Muhammad Usman (Data Persistence & Routing)
 *
 * One document per cross-modality arbitration where camera vs. depth diverged
 * past the drift threshold. This is the LOW-VOLUME, HIGH-VALUE collection — the
 * audit trail of every runtime-safety anomaly the broker intercepted. These are
 * kept permanently (no TTL) and power the dashboard's drift history + the pitch's
 * "anomalies intercepted" metrics.
 */

const mongoose = require('mongoose');

const CoordSchema = new mongoose.Schema(
  { x: Number, y: Number, z: Number },
  { _id: false }
);

const DriftEventSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, index: true },
    // Source telemetry timestamp of the diverging frame pair (Unix epoch ms).
    timestamp: { type: Number, required: true },

    cameraCoordinates: { type: CoordSchema, required: true },
    depthCoordinates: { type: CoordSchema, required: true },
    deltaVector: { type: CoordSchema, required: true },

    euclideanDistance: { type: Number, required: true },
    divergenceScore: { type: Number },
    threshold: { type: Number, required: true },
    status: {
      type: String,
      enum: ['DISAGREEMENT_ANOMALY', 'CONSENSUS_NORMAL'],
      default: 'DISAGREEMENT_ANOMALY',
    },

    executionLatencyMs: { type: Number },
    detectedAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'drift_events' }
);

// Common query: recent drift events for a node, newest first.
DriftEventSchema.index({ nodeId: 1, detectedAt: -1 });

module.exports = mongoose.model('DriftEvent', DriftEventSchema);
