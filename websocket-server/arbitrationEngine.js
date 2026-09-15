/**
 * Continuous Mathematical Arbitration & Disagreement Detection Engine
 * Author: Muhammad Abdullah (Backend & Agentic AI)
 * 
 * Target: Intercept structural edge node misalignment anomalies in under 4ms
 * by calculating continuous running variance and covariance matrices across edge AI telemetry streams.
 */

class RunningVarianceCalculator {
  constructor(windowSize = 30) {
    this.windowSize = windowSize;
    this.buffer = []; // Array of {x, y, z}
  }

  push(coords) {
    this.buffer.push(coords);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }
  }

  /**
   * Computes sample mean, variances, and 3x3 covariance matrix over sliding window
   */
  computeStats() {
    const n = this.buffer.length;
    if (n === 0) {
      return {
        mean: { x: 0, y: 0, z: 0 },
        variance: { x: 0, y: 0, z: 0 },
        stdDev: { x: 0, y: 0, z: 0 },
        covarianceMatrix: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0]
        ]
      };
    }

    // 1. Means
    let sumX = 0, sumY = 0, sumZ = 0;
    for (let i = 0; i < n; i++) {
      sumX += this.buffer[i].x;
      sumY += this.buffer[i].y;
      sumZ += this.buffer[i].z;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    const meanZ = sumZ / n;

    if (n === 1) {
      return {
        mean: { x: meanX, y: meanY, z: meanZ },
        variance: { x: 0, y: 0, z: 0 },
        stdDev: { x: 0, y: 0, z: 0 },
        covarianceMatrix: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0]
        ]
      };
    }

    // 2. Covariance matrix & variances (sample variance n - 1)
    let cXX = 0, cYY = 0, cZZ = 0;
    let cXY = 0, cXZ = 0, cYZ = 0;

    for (let i = 0; i < n; i++) {
      const dx = this.buffer[i].x - meanX;
      const dy = this.buffer[i].y - meanY;
      const dz = this.buffer[i].z - meanZ;

      cXX += dx * dx;
      cYY += dy * dy;
      cZZ += dz * dz;
      cXY += dx * dy;
      cXZ += dx * dz;
      cYZ += dy * dz;
    }

    const denom = n - 1;
    const varX = cXX / denom;
    const varY = cYY / denom;
    const varZ = cZZ / denom;
    const covXY = cXY / denom;
    const covXZ = cXZ / denom;
    const covYZ = cYZ / denom;

    return {
      mean: {
        x: parseFloat(meanX.toFixed(4)),
        y: parseFloat(meanY.toFixed(4)),
        z: parseFloat(meanZ.toFixed(4))
      },
      variance: {
        x: parseFloat(varX.toFixed(4)),
        y: parseFloat(varY.toFixed(4)),
        z: parseFloat(varZ.toFixed(4))
      },
      stdDev: {
        x: parseFloat(Math.sqrt(varX).toFixed(4)),
        y: parseFloat(Math.sqrt(varY).toFixed(4)),
        z: parseFloat(Math.sqrt(varZ).toFixed(4))
      },
      covarianceMatrix: [
        [parseFloat(varX.toFixed(4)), parseFloat(covXY.toFixed(4)), parseFloat(covXZ.toFixed(4))],
        [parseFloat(covXY.toFixed(4)), parseFloat(varY.toFixed(4)), parseFloat(covYZ.toFixed(4))],
        [parseFloat(covXZ.toFixed(4)), parseFloat(covYZ.toFixed(4)), parseFloat(varZ.toFixed(4))]
      ]
    };
  }
}

class ArbitrationEngine {
  constructor(options = {}) {
    this.driftThreshold = options.driftThreshold || 4.0;
    this.windowSize = options.windowSize || 30;
    
    // Per-node, per-sensor sliding window math calculators
    // Format: { [nodeId]: { camera: RunningVarianceCalculator, depth: RunningVarianceCalculator, ... } }
    this.calculators = {};
    
    // Cache readings by nodeId and timestamp to align multi-modal sensors
    // Format: { [nodeId]: { [timestamp]: { camera: payload, depth: payload } } }
    this.syncCache = {};

    this.stats = {
      totalProcessed: 0,
      disagreementsDetected: 0,
      avgLatencyMs: 0
    };
  }

  getCalculator(nodeId, sensorType) {
    if (!this.calculators[nodeId]) {
      this.calculators[nodeId] = {};
    }
    if (!this.calculators[nodeId][sensorType]) {
      this.calculators[nodeId][sensorType] = new RunningVarianceCalculator(this.windowSize);
    }
    return this.calculators[nodeId][sensorType];
  }

  /**
   * Process incoming sensor reading frame and perform continuous mathematical arbitration
   * @param {Object} reading - Telemetry frame matching project schema
   * @returns {Object} Arbitration processing result including variance matrix, consensus status, and execution latency
   */
  processReading(reading) {
    const startTime = process.hrtime.bigint();

    const { nodeId, sensorType, timestamp, coordinates, confidence, sequenceNo } = reading;

    // 1. Update running variance stats for this node & sensor
    const calc = this.getCalculator(nodeId, sensorType);
    calc.push(coordinates);
    const sensorStats = calc.computeStats();

    // 2. Multi-modal alignment buffer
    if (!this.syncCache[nodeId]) {
      this.syncCache[nodeId] = {};
    }
    if (!this.syncCache[nodeId][timestamp]) {
      this.syncCache[nodeId][timestamp] = {};
    }
    this.syncCache[nodeId][timestamp][sensorType] = { reading, stats: sensorStats };

    // Clean up old timestamps from sync cache (keep last 50 timestamps)
    const timestamps = Object.keys(this.syncCache[nodeId]).map(Number).sort((a, b) => a - b);
    if (timestamps.length > 50) {
      const toDelete = timestamps.slice(0, timestamps.length - 50);
      for (const ts of toDelete) {
        delete this.syncCache[nodeId][ts];
      }
    }

    // 3. Perform continuous arbitration cross-modality consensus check if pair exists
    let arbitrationResult = null;
    const framePair = this.syncCache[nodeId][timestamp];

    if (framePair.camera && framePair.depth) {
      arbitrationResult = this.arbitratePair(nodeId, timestamp, framePair.camera, framePair.depth);
    }

    const endTime = process.hrtime.bigint();
    const executionLatencyMs = Number(endTime - startTime) / 1e6; // Convert nanoseconds to milliseconds

    // Track latency statistics
    this.stats.totalProcessed++;
    this.stats.avgLatencyMs = (this.stats.avgLatencyMs * (this.stats.totalProcessed - 1) + executionLatencyMs) / this.stats.totalProcessed;

    return {
      type: 'TELEMETRY_ARBITRATED',
      nodeId,
      sensorType,
      sequenceNo,
      timestamp,
      reading,
      sensorStats,
      arbitrationResult,
      executionLatencyMs: parseFloat(executionLatencyMs.toFixed(3)),
      underTargetLatency: executionLatencyMs < 4.0 // Target is under 4ms
    };
  }

  /**
   * Arbitrates spatial disagreement between vision (camera) and depth sensor modalities
   */
  arbitratePair(nodeId, timestamp, cameraFrame, depthFrame) {
    const cCoords = cameraFrame.reading.coordinates;
    const dCoords = depthFrame.reading.coordinates;

    // Coordinate delta vector
    const deltaX = cCoords.x - dCoords.x;
    const deltaY = cCoords.y - dCoords.y;
    const deltaZ = cCoords.z - dCoords.z;

    // Spatial Euclidean distance (disagreement magnitude)
    const euclideanDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

    // Pooled standard deviation across modalities
    const cStats = cameraFrame.stats;
    const dStats = depthFrame.stats;
    const pooledStdDevX = Math.sqrt((cStats.variance.x + dStats.variance.x) / 2) || 0.001;
    const pooledStdDevY = Math.sqrt((cStats.variance.y + dStats.variance.y) / 2) || 0.001;

    // Normalized divergence score (Z-score space)
    const zScoreX = Math.abs(deltaX) / pooledStdDevX;
    const zScoreY = Math.abs(deltaY) / pooledStdDevY;
    const maxDivergenceScore = parseFloat(Math.max(zScoreX, zScoreY).toFixed(3));

    // Disagreement detection decision
    const disagreementDetected = euclideanDistance > this.driftThreshold;

    if (disagreementDetected) {
      this.stats.disagreementsDetected++;
    }

    return {
      nodeId,
      timestamp,
      cameraCoordinates: cCoords,
      depthCoordinates: dCoords,
      deltaVector: {
        x: parseFloat(deltaX.toFixed(3)),
        y: parseFloat(deltaY.toFixed(3)),
        z: parseFloat(deltaZ.toFixed(3))
      },
      euclideanDistance: parseFloat(euclideanDistance.toFixed(3)),
      divergenceScore: maxDivergenceScore,
      threshold: this.driftThreshold,
      disagreementDetected,
      status: disagreementDetected ? 'DISAGREEMENT_ANOMALY' : 'CONSENSUS_NORMAL',
      covarianceMatrices: {
        camera: cStats.covarianceMatrix,
        depth: dStats.covarianceMatrix
      }
    };
  }

  getStats() {
    return {
      totalProcessed: this.stats.totalProcessed,
      disagreementsDetected: this.stats.disagreementsDetected,
      avgLatencyMs: parseFloat(this.stats.avgLatencyMs.toFixed(4)),
      driftThreshold: this.driftThreshold
    };
  }
}

module.exports = {
  RunningVarianceCalculator,
  ArbitrationEngine
};
