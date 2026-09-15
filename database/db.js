/**
 * MongoDB Connection Module — Data Persistence & Routing Layer
 * Author: Muhammad Usman (Backend, Agentic AI & Deployment)
 *
 * Single env-driven connection (MONGODB_URI) that works identically against a
 * local Docker MongoDB (dev) and a hosted MongoDB Atlas cluster (prod) — swap the
 * URI, nothing else. Tuned for high-throughput telemetry ingestion with a large
 * connection pool, and designed to DEGRADE GRACEFULLY: if the database is
 * unreachable the WebSocket pipeline keeps running (live demo never dies), it
 * just stops persisting until the connection recovers.
 */

const mongoose = require('mongoose');

// ─── Configuration ───────────────────────────────────────────────────────────
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/consensus_broker';

const CONNECT_OPTIONS = {
  // High-throughput ingestion: keep a generous pool of sockets warm.
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL, 10) || 50,
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL, 10) || 5,
  serverSelectionTimeoutMS: 5000, // fail fast so startup isn't blocked when DB is down
  socketTimeoutMS: 45000,
  // Write concern w:1 (default) — fast acks, appropriate for telemetry volume.
};

let isConnected = false;
let hasLoggedDegraded = false;

/**
 * Attempt to connect. Never throws — returns true on success, false otherwise,
 * so callers can decide whether persistence is available without try/catch noise.
 */
async function connect() {
  if (isConnected) return true;
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI, CONNECT_OPTIONS);
    isConnected = true;
    hasLoggedDegraded = false;
    const { host, name } = mongoose.connection;
    console.log(`[DB] Connected to MongoDB at ${host} (db: ${name})`);
  } catch (err) {
    isConnected = false;
    if (!hasLoggedDegraded) {
      console.warn(
        `[DB] Could not connect to MongoDB (${err.message}). ` +
          `Running in DEGRADED mode — telemetry will not be persisted.`
      );
      hasLoggedDegraded = true;
    }
  }
  return isConnected;
}

// Keep isConnected in sync with the driver's own lifecycle events.
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[DB] MongoDB disconnected — persistence paused.');
});
mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[DB] MongoDB reconnected — persistence resumed.');
});
mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB connection error:', err.message);
});

function connected() {
  return isConnected && mongoose.connection.readyState === 1;
}

async function disconnect() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[DB] MongoDB connection closed.');
}

module.exports = { connect, disconnect, connected, mongoose, MONGODB_URI };
