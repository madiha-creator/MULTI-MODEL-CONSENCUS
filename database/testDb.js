/**
 * Persistence Layer Smoke Test — Data Persistence & Routing
 * Author: Muhammad Usman
 *
 * Verifies end-to-end that the persistence layer can connect, buffer, flush, and
 * read back both a telemetry reading and a drift event. Requires a running
 * MongoDB (e.g. `npm run db:up`).
 *
 *   npm run test:db
 */

const database = require('./index');

async function run() {
  console.log('\n=== Persistence Layer Smoke Test ===\n');

  console.log('1. Connecting to MongoDB...');
  const ok = await database.connect();
  if (!ok) {
    console.error('❌ Could not connect. Start MongoDB first: npm run db:up');
    process.exit(1);
  }
  console.log('✅ Connected.');

  database.persistence.start();

  // Simulate an arbitrated packet WITH a disagreement (writes reading + drift event).
  const now = Date.now();
  const packet = {
    type: 'TELEMETRY_ARBITRATED',
    nodeId: 'test-node-99',
    sensorType: 'depth',
    sequenceNo: 1,
    timestamp: now,
    reading: { coordinates: { x: 56.5, y: 34.2, z: 0.0 }, confidence: 0.62 },
    sensorStats: {
      mean: { x: 50, y: 30, z: 0 },
      variance: { x: 1, y: 1, z: 0 },
      stdDev: { x: 1, y: 1, z: 0 },
    },
    executionLatencyMs: 0.42,
    underTargetLatency: true,
    arbitrationResult: {
      nodeId: 'test-node-99',
      timestamp: now,
      cameraCoordinates: { x: 50, y: 30, z: 0 },
      depthCoordinates: { x: 56.5, y: 34.2, z: 0 },
      deltaVector: { x: 6.5, y: 4.2, z: 0 },
      euclideanDistance: 7.74,
      divergenceScore: 5.1,
      threshold: 4.0,
      disagreementDetected: true,
      status: 'DISAGREEMENT_ANOMALY',
    },
  };

  console.log('2. Ingesting a synthetic drift packet...');
  database.persistence.ingest(packet);

  console.log('3. Flushing buffers to MongoDB...');
  await database.persistence.flush();

  console.log('4. Reading back...');
  const drifts = await database.queries.recentDriftEvents({ nodeId: 'test-node-99', limit: 5 });
  const readings = await database.queries.recentReadings({ nodeId: 'test-node-99', limit: 5 });
  const summary = await database.queries.summary();

  console.log(`   drift events for test-node-99: ${drifts.length}`);
  console.log(`   readings for test-node-99:     ${readings.length}`);
  console.log(`   summary:`, summary);

  const pass = drifts.length > 0 && readings.length > 0;
  console.log(`\n5. Persistence stats:`, database.persistence.getStats());

  await database.persistence.stop();
  await database.disconnect();

  if (pass) {
    console.log('\n🎉 Persistence smoke test PASSED.\n');
    process.exit(0);
  } else {
    console.error('\n❌ Persistence smoke test FAILED (nothing read back).\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
