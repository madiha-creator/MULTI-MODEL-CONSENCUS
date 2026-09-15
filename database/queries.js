/**
 * Read-side queries — powers the dashboard's history views & REST endpoints.
 * Author: Muhammad Usman (Data Persistence & Routing)
 */

const db = require('./db');
const TelemetryReading = require('./models/TelemetryReading');
const DriftEvent = require('./models/DriftEvent');

/** Most recent drift anomalies, newest first. */
async function recentDriftEvents({ nodeId, limit = 50 } = {}) {
  if (!db.connected()) return [];
  const filter = nodeId ? { nodeId } : {};
  return DriftEvent.find(filter).sort({ detectedAt: -1 }).limit(limit).lean();
}

/** Most recent telemetry readings, newest first. */
async function recentReadings({ nodeId, sensorType, limit = 100 } = {}) {
  if (!db.connected()) return [];
  const filter = {};
  if (nodeId) filter.nodeId = nodeId;
  if (sensorType) filter.sensorType = sensorType;
  return TelemetryReading.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
}

/** Aggregate persistence counters for /health & the pitch metrics. */
async function summary() {
  if (!db.connected()) {
    return { dbConnected: false, totalReadings: 0, totalDriftEvents: 0, nodes: [] };
  }
  const [totalReadings, totalDriftEvents, nodes] = await Promise.all([
    TelemetryReading.estimatedDocumentCount(),
    DriftEvent.countDocuments(),
    DriftEvent.distinct('nodeId'),
  ]);
  return { dbConnected: true, totalReadings, totalDriftEvents, nodes };
}

module.exports = { recentDriftEvents, recentReadings, summary };
