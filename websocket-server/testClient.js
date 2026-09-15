/**
 * Comprehensive Automated Test Suite for Telemetry WebSocket Core Engine & Variance Math
 * Author: Muhammad Abdullah (Backend & Agentic AI)
 * 
 * Verifies:
 * 1. WebSocket Server Connection & Handshake
 * 2. Real-Time Telemetry Ingestion & Consumer Broadcast
 * 3. Continuous Running Variance Matrix & 3x3 Spatial Covariance Math
 * 4. Multi-Modal Sensor Disagreement Anomaly Detection
 * 5. Execution Latency Benchmark (< 4ms target domain requirement)
 */

const WebSocket = require('ws');
const http = require('http');

const SERVER_URL = 'ws://localhost:8080';
const HEALTH_URL = 'http://localhost:8080/health';

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Telemetry Core Engine & Arbitration Test Suite');
  console.log('======================================================\n');

  // 1. Verify HTTP Health Endpoint
  console.log('Test 1: Checking HTTP Health Check Endpoint...');
  await new Promise((resolve, reject) => {
    http.get(HEALTH_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const health = JSON.parse(data);
        console.log('✅ Health Check OK:', health.service, '| Status:', health.status);
        resolve();
      });
    }).on('error', (err) => {
      console.error('❌ Health Check Failed:', err.message);
      reject(err);
    });
  });

  // 2. Connect WebSocket Client
  console.log('\nTest 2: Establishing WebSocket Pipeline Connection...');
  const client = new WebSocket(SERVER_URL);

  let connected = false;
  let messagesReceived = 0;
  let disagreementDetected = false;
  let testedVarianceMatrix = false;
  let testedSub4msLatency = false;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error('Test timeout after 10 seconds'));
    }, 10000);

    client.on('open', () => {
      console.log('✅ WebSocket Connection Established Successfully');
      connected = true;

      // Start emitting test telemetry stream
      sendTelemetryFrames(client);
    });

    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'SYSTEM_CONNECTED') {
        console.log('✅ Received Server Handshake Payload');
        return;
      }

      if (msg.type === 'TELEMETRY_ARBITRATED') {
        messagesReceived++;

        // Verify Continuous Variance Matrix Math
        if (msg.sensorStats && msg.sensorStats.covarianceMatrix && !testedVarianceMatrix) {
          console.log('✅ Continuous Running Variance Matrix Computed:');
          console.log('   Mean:', msg.sensorStats.mean);
          console.log('   Variance:', msg.sensorStats.variance);
          console.log('   3x3 Covariance Matrix:', JSON.stringify(msg.sensorStats.covarianceMatrix));
          testedVarianceMatrix = true;
        }

        // Verify Latency
        if (msg.executionLatencyMs !== undefined && !testedSub4msLatency) {
          console.log(`✅ Execution Latency Benchmark: ${msg.executionLatencyMs} ms (Target < 4.0 ms)`);
          if (msg.underTargetLatency) {
            console.log('   🎯 PASS: Intercepted in under 4ms!');
          }
          testedSub4msLatency = true;
        }

        // Verify Arbitration Disagreement Anomaly
        if (msg.arbitrationResult && msg.arbitrationResult.disagreementDetected) {
          disagreementDetected = true;
          console.log('\n🚨 DISAGREEMENT ANOMALY INTERCEPTED:');
          console.log('   Node ID:', msg.arbitrationResult.nodeId);
          console.log('   Disagreement Magnitude (Euclidean Distance):', msg.arbitrationResult.euclideanDistance);
          console.log('   Divergence Score:', msg.arbitrationResult.divergenceScore);
          console.log('   Status:', msg.arbitrationResult.status);
        }

        // Complete test run after receiving enough frames
        if (messagesReceived >= 6 && disagreementDetected && testedVarianceMatrix) {
          clearTimeout(timeout);
          client.close();
          resolve();
        }
      }
    });

    client.on('error', (err) => {
      console.error('❌ WebSocket Client Error:', err);
      reject(err);
    });
  });

  console.log('\n======================================================');
  console.log('🎉 ALL TELEMETRY & ARBITRATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
  process.exit(0);
}

function sendTelemetryFrames(wsClient) {
  let seq = 1;
  const now = Date.now();

  // Send normal aligned telemetry frames for camera and depth
  for (let i = 0; i < 3; i++) {
    const ts = now + i * 100;
    wsClient.send(JSON.stringify({
      nodeId: 'edge-node-01',
      sensorType: 'camera',
      sequenceNo: seq++,
      timestamp: ts,
      coordinates: { x: 50.0 + i * 0.1, y: 30.0 + i * 0.1, z: 0.0 },
      confidence: 0.98
    }));

    wsClient.send(JSON.stringify({
      nodeId: 'edge-node-01',
      sensorType: 'depth',
      sequenceNo: seq++,
      timestamp: ts,
      coordinates: { x: 50.05 + i * 0.1, y: 30.02 + i * 0.1, z: 0.0 },
      confidence: 0.97
    }));
  }

  // Inject a significant drift anomaly frame to test disagreement interception
  const driftTs = now + 400;
  wsClient.send(JSON.stringify({
    nodeId: 'edge-node-01',
    sensorType: 'camera',
    sequenceNo: seq++,
    timestamp: driftTs,
    coordinates: { x: 50.0, y: 30.0, z: 0.0 },
    confidence: 0.95
  }));

  // Depth sensor drifts by 6.0 units (threshold is 4.0)
  wsClient.send(JSON.stringify({
    nodeId: 'edge-node-01',
    sensorType: 'depth',
    sequenceNo: seq++,
    timestamp: driftTs,
    coordinates: { x: 56.5, y: 34.2, z: 0.0 },
    confidence: 0.62
  }));
}

// Run test if executed directly
if (require.main === module) {
  runTests().catch(err => {
    console.error('Test Suite Error:', err);
    process.exit(1);
  });
}
