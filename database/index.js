/**
 * Data Persistence & Routing module — public entrypoint
 * Author: Muhammad Usman (Backend, Agentic AI & Deployment)
 *
 * Usage from the WebSocket server:
 *   const database = require('../database');
 *   await database.connect();               // connect (non-fatal if DB is down)
 *   database.persistence.start();           // start the buffered writer
 *   database.persistence.ingest(packet);    // per arbitrated frame (non-blocking)
 */

const db = require('./db');
const persistence = require('./persistence');
const queries = require('./queries');
const TelemetryReading = require('./models/TelemetryReading');
const DriftEvent = require('./models/DriftEvent');

module.exports = {
  connect: db.connect,
  disconnect: db.disconnect,
  connected: db.connected,
  persistence,
  queries,
  models: { TelemetryReading, DriftEvent },
};
