// Mock telemetry WebSocket server.
//
// SCENARIO_MODE: demo scenario cycle — default ON.
//   Cycle: 20 ticks AGREEMENT → 10 DEGRADED (one sensor gradually diverges)
//   → 6 FAILED (four sensors diverge hard), repeating every 36 ticks / 36 s.
//   Set SCENARIO_ENABLED = false for the old raw-random behavior.
//
// OPERATOR MODE (Prompt 7): clients may send outbound `control` frames
// (schema mirrored from src/lib/ws/validate.ts below) to set per-sensor drift
// overlays, toggle sensors offline, inject a malformed frame, or reset. A
// non-empty overlay/offline set PAUSES the scripted cycle (the tick clock
// freezes; `reset_all` resumes from the same tick) and generates from a healthy
// baseline + the operator overlay. Everything downstream — disagreement pairs,
// consensus contribution/exclusion, risk, outliers, action gate, consumers —
// flows through the SAME per-tick recomputation, so manual drift produces real
// consensus results, never scripted ones. drift_state is likewise derived
// honestly: magnitude/direction = measured worst deviation from baseline.
//
// The inbound wire contract is 13 message types (the 12 originals + additive
// `overlay_state`, the server-authoritative echo of the operator overlay).
// src/lib/ws/validate.ts accepts them. The frontend derives its consensus
// verdict (AGREEMENT/DEGRADED/FAILED) from payload fields only
// (src/lib/consensus/status.ts). The phase ratios produced here only FLOOR at
// the verdict boundary constants (RATIO_FAIL_MAX = 0.5, RATIO_AGREE_MIN = 0.95)
// once the scripted ramp crosses the 0.6 contributing floor:
//   AGREEMENT → 1.0 · DEGRADED victim conf 0.85−0.06i ⇒ ticks 0–4 still read
//   a legitimate AGREEMENT (conf ≥ 0.6, verdict-safe ramp), ticks 5+ → 0.83
//   · FAILED → 0.33. Live replay: 40-tick cycle = AGREEMENT×26 / DEGRADED×5 /
//   FAILED×6 (ledger 108) — the first DEGRADED ticks being AGREEMENT is the
//   honest ramp, not a bug; the phase EVENT announces intent, the verdict
//   reads payload.
//
// Per-connection state (Prompt 8): tick clock, event ids, uptime and operator
// overlay all live in the connection closure, so two tabs each run their own
// 36 s cycle in phase-sync instead of advancing a shared counter at N× speed.

const { WebSocketServer } = require('ws');
// Control-frame validation mirrors the frontend's Zod contract (zod ships a
// CJS build, so require resolves it for Node scripts too).
const { z } = require('zod');

const PORT = 8080;

const SENSORS = [
  { id: 'imu-01', name: 'IMU Alpha', type: 'imu', unit: 'deg/s', baseValue: 0.5 },
  { id: 'imu-02', name: 'IMU Bravo', type: 'imu', unit: 'deg/s', baseValue: 0.48 },
  { id: 'lidar-01', name: 'LiDAR Primary', type: 'lidar', unit: 'm', baseValue: 12.3 },
  { id: 'lidar-02', name: 'LiDAR Secondary', type: 'lidar', unit: 'm', baseValue: 12.1 },
  { id: 'temp-01', name: 'Thermal Core', type: 'thermal', unit: 'C', baseValue: 42.0 },
  { id: 'gyro-01', name: 'Gyro Master', type: 'gyro', unit: 'rpm', baseValue: 1200 },
];

const SENSOR_IDS = new Set(SENSORS.map((s) => s.id));
const BASE_BY_ID = Object.fromEntries(SENSORS.map((s) => [s.id, s.baseValue]));

// Downstream AI agents that consume the broker's trusted state.
const AGENTS = [
  { id: 'agent-a', name: 'Navigator' },
  { id: 'agent-b', name: 'Planner' },
  { id: 'agent-c', name: 'Safety Monitor' },
];

// ── MIRROR of src/lib/ws/validate.ts ControlMessageSchema — keep in sync ────
const ControlMessageSchema = z.object({
  type: z.literal('control'),
  payload: z.discriminatedUnion('action', [
    z.object({ action: z.literal('set_drift'), sensorId: z.string().min(1), offsetPct: z.number().min(-50).max(50) }),
    z.object({ action: z.literal('clear_drift'), sensorId: z.string().min(1) }),
    z.object({ action: z.literal('set_offline'), sensorId: z.string().min(1), offline: z.boolean() }),
    z.object({ action: z.literal('inject_malformed') }),
    z.object({ action: z.literal('reset_all') }),
  ]),
});

// ---- scenario cycle --------------------------------------------------------

const SCENARIO_ENABLED = true;
const PHASES = [
  { name: 'AGREEMENT', ticks: 20 },
  { name: 'DEGRADED', ticks: 10 },
  { name: 'FAILED', ticks: 6 },
];
const CYCLE_TICKS = PHASES.reduce((sum, p) => sum + p.ticks, 0); // 36

// Stable per-cycle picks so transitions read as causal, not random.
// DEGRADED victim is lidar-02 (index 3): it shares the 'm' unit with
// lidar-01, so its divergence also lights the StateMesh disagreement edge.
const DEGRADED_VICTIM = 3;
// FAILED victims (indices): imu-02, lidar-02, temp-01, gyro-01 —
// 4 diverge, 2 survive tight ⇒ agreementRatio 2/6 = 0.33 < RATIO_FAIL_MAX.
const FAILED_VICTIMS = [1, 3, 4, 5];

function phaseAt(tick) {
  if (!SCENARIO_ENABLED) return { name: 'AGREEMENT', i: 0 };
  const t = tick % CYCLE_TICKS;
  if (t < 20) return { name: 'AGREEMENT', i: t };
  if (t < 30) return { name: 'DEGRADED', i: t - 20 };
  return { name: 'FAILED', i: t - 30 };
}

// ---- helpers ----------------------------------------------------------------

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function generateTelemetry(phase, tick) {
  return SENSORS.map((s, i) => {
    let value = s.baseValue + rand(-0.05, 0.05) * s.baseValue;
    let confidence = rand(0.85, 0.99);
    let status = 'normal';

    if (!SCENARIO_ENABLED) {
      // Legacy raw-random mode: every 20th tick one sensor goes critical.
      const introduceOutlier = tick % 20 === 0;
      const outlierSensor = introduceOutlier ? Math.floor(rand(0, SENSORS.length)) : -1;
      if (i === outlierSensor) {
        value = s.baseValue * rand(1.3, 1.8);
        confidence = rand(0.2, 0.5);
        status = 'critical';
      } else if (Math.random() < 0.05) {
        confidence = rand(0.5, 0.7);
        status = 'warning';
      }
    } else if (phase.name === 'DEGRADED' && i === DEGRADED_VICTIM) {
      // Gradual divergence — judges watch one sensor slide out of agreement.
      const drift = 1 + 0.045 * phase.i; // +0% → +45% over the phase
      value = s.baseValue * drift;
      confidence = Math.max(0.25, 0.85 - 0.06 * phase.i);
      status = confidence < 0.6 ? 'critical' : 'warning';
    } else if (phase.name === 'FAILED' && FAILED_VICTIMS.includes(i)) {
      // Hard split: victims alternate far below / far above their baseline.
      const k = FAILED_VICTIMS.indexOf(i);
      const factor = k % 2 === 0 ? rand(0.25, 0.45) : rand(1.9, 2.6);
      value = s.baseValue * factor;
      confidence = rand(0.1, 0.4);
      status = 'critical';
    } else {
      // Healthy sensor (any phase): tight around baseline with high confidence.
      value = s.baseValue * (1 + rand(-0.02, 0.02));
      confidence = rand(0.9, 0.98);
      // Occasional mild warning during AGREEMENT only — kept ABOVE the 0.6
      // contributing floor so it never flickers the consensus verdict.
      if (phase.name === 'AGREEMENT' && Math.random() < 0.05) {
        confidence = rand(0.62, 0.75);
        status = 'warning';
      }
    }

    return {
      sensorId: s.id,
      sensorName: s.name,
      sensorType: s.type,
      value: round3(value),
      unit: s.unit,
      confidence: round2(confidence),
      timestamp: Date.now(),
      status,
    };
  });
}

// Manual-mode canvas: every sensor tight around its baseline — the scripted
// victims never appear while the operator holds overlay state. Mirrors the
// healthy branch of generateTelemetry; a separate pure function so the
// scripted path stays byte-identical.
function generateBaselineSensors() {
  return SENSORS.map((s) => ({
    sensorId: s.id,
    sensorName: s.name,
    sensorType: s.type,
    value: round3(s.baseValue * (1 + rand(-0.02, 0.02))),
    unit: s.unit,
    confidence: round2(rand(0.9, 0.98)),
    timestamp: Date.now(),
    status: 'normal',
  }));
}

// Operator overlay (Prompt 7): drift offsets + offline toggles applied to the
// sensor array BEFORE the consensus chain runs, so disagreement/consensus/risk/
// outliers/gate all react to real values — nothing downstream is faked.
// Confidence math mirrors the scripted DEGRADED victim slope, so an offset
// ≥ ~24% crosses the 0.6 contributing floor and flows through the pipeline as
// a genuine outlier.
function applyOperatorState(sensors, overlay, offlineSet) {
  return sensors.map((s) => {
    if (offlineSet.has(s.sensorId)) {
      return { ...s, value: 0, confidence: 0, status: 'offline' };
    }
    const pct = overlay[s.sensorId];
    if (pct === undefined) return s;
    const base = BASE_BY_ID[s.sensorId];
    const confidence = round2(Math.min(0.99, Math.max(0.15, 0.95 - Math.abs(pct) * 0.015)));
    return {
      ...s,
      value: round3(base * (1 + pct / 100)),
      confidence,
      status: confidence < 0.6 ? 'critical' : 'warning',
    };
  });
}

// set_drift semantics as a pure mutation of the overlay map: a 0% offset
// CLEARS instead of recording — a zero entry would still trip manualActive()
// and freeze the scripted cycle, faking MANUAL with nothing actually drifted.
// Returns what happened so the handler only bumps revision on real changes.
function applyDriftSet(overlay, sensorId, offsetPct) {
  if (offsetPct === 0) {
    const had = overlay[sensorId] !== undefined;
    delete overlay[sensorId];
    return had ? 'cleared' : 'noop';
  }
  overlay[sensorId] = offsetPct;
  return 'set';
}

function generateDisagreement(sensors) {
  const pairs = [];
  for (let i = 0; i < sensors.length; i++) {
    for (let j = i + 1; j < sensors.length; j++) {
      // An offline sensor isn't reading at all — it can't disagree; it just
      // stops being part of the electorate (consensus excludes it already).
      if (sensors[i].status === 'offline' || sensors[j].status === 'offline') continue;
      if (sensors[i].unit === sensors[j].unit) {
        const variance = Math.abs(sensors[i].value - sensors[j].value);
        const threshold = sensors[i].value * 0.1;
        pairs.push({
          sensorPair: [sensors[i].sensorId, sensors[j].sensorId],
          variance: round3(variance),
          threshold: round3(threshold),
          isDisagreeing: variance > threshold,
          timestamp: Date.now(),
        });
      }
    }
  }
  return pairs;
}

function generateConsensus(sensors) {
  const normalSensors = sensors.filter((s) => s.status !== 'offline');
  // `|| 1` guards the total-blackout edge (all sensors offline) from NaN.
  const avgConfidence = normalSensors.length
    ? normalSensors.reduce((sum, s) => sum + s.confidence, 0) / normalSensors.length
    : 0;

  const contributingSensors = normalSensors.filter(
    (s) => s.confidence > 0.6 && s.status !== 'critical'
  );
  const contributing = contributingSensors.map((s) => s.sensorId);
  const excluded = normalSensors
    .filter((s) => !contributing.includes(s.sensorId))
    .map((s) => s.sensorId);

  // Trusted value = mean of the agreeing sensors' readings. Mixed-unit demo
  // data ⇒ the UI labels this "unitless demo" rather than inventing units.
  const trustedValue = contributingSensors.length
    ? round3(
        contributingSensors.reduce((sum, s) => sum + s.value, 0) / contributingSensors.length
      )
    : 0;

  return {
    trustedValue,
    confidence: round2(avgConfidence),
    // Phase floors stay clear of the frontend verdict boundaries:
    // AGREEMENT 1.0 · DEGRADED 5/6 = 0.83 · FAILED 2/6 = 0.33.
    agreementRatio: round2(contributing.length / (normalSensors.length || 1)),
    contributingSensors: contributing,
    excludedSensors: excluded,
    timestamp: Date.now(),
  };
}

function generateRisk(sensors, disagreement, consensus) {
  const criticalCount = sensors.filter((s) => s.status === 'critical').length;
  const disagreeCount = disagreement.filter((d) => d.isDisagreeing).length;

  let score = criticalCount * 25 + disagreeCount * 10;
  const ratio = consensus.agreementRatio;
  if (ratio < 0.5) score += 60; // consensus collapse (RATIO_FAIL_MAX)
  else if (ratio < 0.95) score += 20; // degraded (RATIO_AGREE_MIN)
  score = Math.min(100, score);

  let level = 'low';
  if (score > 60) level = 'critical';
  else if (score > 40) level = 'high';
  else if (score > 20) level = 'medium';

  const factors = [];
  const affectedSensors = [];
  if (criticalCount > 0) {
    factors.push(`${criticalCount} critical sensor(s)`);
    sensors
      .filter((s) => s.status === 'critical')
      .forEach((s) => affectedSensors.push(s.sensorId));
  }
  if (disagreeCount > 0) {
    factors.push(`${disagreeCount} disagreement(s) detected`);
    disagreement
      .filter((d) => d.isDisagreeing)
      .forEach((d) => {
        if (!affectedSensors.includes(d.sensorPair[0])) affectedSensors.push(d.sensorPair[0]);
        if (!affectedSensors.includes(d.sensorPair[1])) affectedSensors.push(d.sensorPair[1]);
      });
  }
  if (ratio < 0.95) {
    factors.push(`agreement ratio ${Math.round(ratio * 100)}%`);
    consensus.excludedSensors.forEach((id) => {
      if (!affectedSensors.includes(id)) affectedSensors.push(id);
    });
  }

  return { level, score, factors, affectedSensors, timestamp: Date.now() };
}

function generateActionGate(risk, consensus, outliers) {
  if (
    risk.level === 'critical' ||
    (risk.level === 'high' && outliers.length > 0)
  ) {
    return {
      state: 'BLOCK',
      reason: `Safety refusal: ${risk.factors.join(', ')}`,
      triggeredBy: 'risk-engine',
      timestamp: Date.now(),
    };
  }
  if (risk.level === 'high' || consensus.agreementRatio < 0.95) {
    return {
      state: 'HOLD',
      reason: `Agreement ${Math.round(consensus.agreementRatio * 100)}% below safety margin`,
      triggeredBy: 'consensus-engine',
      timestamp: Date.now(),
    };
  }
  return {
    state: 'ALLOW',
    reason: 'All systems nominal',
    triggeredBy: 'consensus-engine',
    timestamp: Date.now(),
  };
}

function generateOutliers(sensors) {
  return sensors
    // An offline sensor is absent from the electorate, not an outlier —
    // calling confidence 0 a "low-confidence reading" would be misleading.
    .filter((s) => s.status !== 'offline' && (s.confidence < 0.6 || s.status === 'critical'))
    .map((s) => ({
      sensorId: s.sensorId,
      sensorName: s.sensorName,
      deviation: round2(1 - s.confidence),
      reason: s.status === 'critical' ? 'Critical reading' : 'Low confidence',
      flaggedAt: Date.now(),
    }));
}

// Honest drift derivation (Prompt 7): magnitude/direction are MEASURED — the
// worst absolute deviation of any live reading from its baseline (so the
// scripted DEGRADED ramp and operator overlays both read truthfully).
// affectedSensors lists the OPERATOR overlay only — who was made to drift,
// as opposed to what drifted. lastCorrection is a real timestamp.
function generateDriftState(sensors, overlay, lastOverlayChangeAt) {
  let worst = null;
  for (const s of sensors) {
    if (s.status === 'offline') continue;
    const deviation = s.value / BASE_BY_ID[s.sensorId] - 1;
    if (worst === null || Math.abs(deviation) > Math.abs(worst)) worst = deviation;
  }
  const magnitude = worst === null ? 0 : Math.min(1, round2(Math.abs(worst)));
  const direction = magnitude < 0.02 ? 'none' : worst > 0 ? 'positive' : 'negative';

  return {
    magnitude,
    direction,
    affectedSensors: Object.keys(overlay),
    lastCorrection: lastOverlayChangeAt,
    timestamp: Date.now(),
  };
}

function generateActuatorState(gateState) {
  const isAllowed = gateState === 'ALLOW';
  return {
    motorEnabled: isAllowed,
    motorRpm: isAllowed ? Math.round(rand(800, 1400)) : 0,
    servoAngle: isAllowed ? Math.round(rand(45, 135)) : 90,
    emergencyStop: gateState === 'BLOCK',
    lastCommand: isAllowed ? 'run' : gateState === 'BLOCK' ? 'estop' : 'hold',
    timestamp: Date.now(),
  };
}

// Agent-bus story now tracks the REAL consensus each tick (Prompt 7): with
// the scripted phases the mapping is identical (ratio floors 1.0/0.83/0.33
// line up with the phase names by construction), but manual overlays get an
// honest bus story too:
//   ratio ≥ 0.95 → all agents consume fresh trusted state (active)
//   0.5 ≤ ratio < 0.95 → agent-b falls behind (stale: acting on a 3s-old,
//               slightly offset value — the UI shows the lag honestly)
//   ratio < 0.5 → broker withholds trusted state (a/b HELD, no value shown)
//               and agent-c drops off the bus entirely (offline)
function consumersStoryFor(consensus) {
  if (consensus.agreementRatio >= 0.95) return { name: 'AGREEMENT', i: 0 };
  if (consensus.agreementRatio >= 0.5) return { name: 'DEGRADED', i: 0 };
  return { name: 'FAILED', i: 0 };
}

function generateConsumers(phase, consensus) {
  const now = Date.now();
  return AGENTS.map((a, i) => {
    let status = 'active';
    if (phase.name === 'DEGRADED' && i === 1) status = 'stale';
    if (phase.name === 'FAILED') status = i === 2 ? 'offline' : 'held';
    return {
      agentId: a.id,
      agentName: a.name,
      status,
      consumedValue:
        status === 'active'
          ? consensus.trustedValue
          : status === 'stale'
            ? round3(consensus.trustedValue * 0.94)
            : null,
      lastSync: status === 'active' ? now : status === 'stale' ? now - 3000 : now - 9000,
    };
  });
}

function generateConnectionMetrics(messageCount, startTime) {
  return {
    latencyMs: Math.round(rand(12, 85)),
    // Server-side reconnectCount is knowingly 0 — a server can't see client
    // retries; the client store overrides it with its own real counter.
    reconnectCount: 0,
    uptimeMs: Date.now() - startTime,
    lastMessageTime: Date.now(),
    messagesReceived: messageCount,
  };
}

function broadcast(client, data) {
  if (client.readyState === 1) {
    client.send(JSON.stringify(data));
  }
}

// ---- server (skipped when imported by the test suite) ------------------------

if (require.main === module) {
  const wss = new WebSocketServer({ port: PORT });

  wss.on('connection', (ws) => {
    console.log('[Mock WS] Client connected');

    // ── per-connection state (Prompt 8: two tabs no longer corrupt each other)
    let tickCount = 0; // scripted-cycle clock — PAUSES under operator control
    let realTicks = 0; // wall-clock ticks — always advances (metrics cadence)
    let eventId = 0;
    let messageCount = 0;
    const startTime = Date.now();
    const makeEvent = (type, message, severity, source) => ({
      id: `evt-${++eventId}`,
      type,
      message,
      severity,
      timestamp: Date.now(),
      source,
    });

    // ── operator overlay state (control frames mutate these)
    const overlay = {}; // sensorId → offsetPct
    const offlineSet = new Set(); // sensorIds forced offline
    let revision = 0; // mutation counter echoed in overlay_state
    let lastOverlayChangeAt = Date.now();
    let malformedKind = 'schema'; // alternate so repeated clicks exercise both rejection paths
    const manualActive = () => Object.keys(overlay).length > 0 || offlineSet.size > 0;

    const sendTick = () => {
      realTicks++;
      const manual = manualActive();
      const phase = manual ? null : phaseAt(tickCount);
      if (!manual) tickCount++; // the scripted clock PAUSES while the operator drives

      const base = manual ? generateBaselineSensors() : generateTelemetry(phase, tickCount);
      const sensors = applyOperatorState(base, overlay, offlineSet);
      const disagreement = generateDisagreement(sensors);
      const consensus = generateConsensus(sensors);
      const risk = generateRisk(sensors, disagreement, consensus);
      const outliers = generateOutliers(sensors);
      const actionGate = generateActionGate(risk, consensus, outliers);
      const driftState = generateDriftState(sensors, overlay, lastOverlayChangeAt);
      const actuatorState = generateActuatorState(actionGate.state);
      const consumers = generateConsumers(consumersStoryFor(consensus), consensus);
      const overlayState = {
        entries: Object.entries(overlay).map(([sensorId, offsetPct]) => ({ sensorId, offsetPct })),
        offlineSensors: [...offlineSet],
        mode: manual ? 'manual' : 'auto',
        revision,
        timestamp: Date.now(),
      };

      messageCount += 10;

      broadcast(ws, { type: 'telemetry', payload: sensors });
      broadcast(ws, { type: 'disagreement', payload: disagreement });
      broadcast(ws, { type: 'consensus', payload: consensus });
      broadcast(ws, { type: 'risk', payload: risk });
      broadcast(ws, { type: 'action_gate', payload: actionGate });
      broadcast(ws, { type: 'outliers', payload: outliers });
      broadcast(ws, { type: 'drift_state', payload: driftState });
      broadcast(ws, { type: 'actuator_state', payload: actuatorState });
      broadcast(ws, { type: 'consumers', payload: consumers });
      broadcast(ws, { type: 'overlay_state', payload: overlayState });

      if (realTicks % 5 === 0) {
        broadcast(ws, { type: 'connection_metrics', payload: generateConnectionMetrics(messageCount, startTime) });
      }

      if (!manual && SCENARIO_ENABLED && phase.i === 0) {
        const severity = phase.name === 'FAILED' ? 'critical' : phase.name === 'DEGRADED' ? 'warning' : 'info';
        const detail =
          phase.name === 'AGREEMENT'
            ? 'All sensors in agreement — proceeding'
            : phase.name === 'DEGRADED'
              ? `${SENSORS[DEGRADED_VICTIM].name} diverging — trusted state from agreeing sensors`
              : 'Multiple sensors diverging — consensus will fail';
        broadcast(ws, {
          type: 'event',
          payload: makeEvent('consensus', `Scenario ${phase.name}: ${detail}`, severity, 'scenario-engine'),
        });
      }

      const disagreeCount = disagreement.filter((d) => d.isDisagreeing).length;
      if (disagreeCount > 0) {
        broadcast(ws, {
          type: 'event',
          payload: makeEvent(
            'disagreement',
            `${disagreeCount} sensor pair(s) disagreeing`,
            disagreeCount > 2 ? 'critical' : 'warning',
            'arbitration-engine'
          ),
        });
      }

      if (outliers.length > 0) {
        broadcast(ws, {
          type: 'event',
          payload: makeEvent(
            'risk',
            `Outlier detected: ${outliers.map((o) => o.sensorName).join(', ')}`,
            'warning',
            'outlier-detector'
          ),
        });
      }

      if (!manual) {
        broadcast(ws, {
          type: 'event',
          payload: makeEvent('system', `Telemetry cycle #${tickCount} complete`, 'info', 'mock-server'),
        });
      }
    };

    const interval = setInterval(sendTick, 1000);
    sendTick();

    ws.on('close', () => {
      console.log('[Mock WS] Client disconnected');
      clearInterval(interval);
    });

    const operatorEvent = (message, severity) =>
      broadcast(ws, { type: 'event', payload: makeEvent('system', message, severity, 'operator') });

    ws.on('message', (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        return; // unparseable client traffic is not our problem to answer
      }

      if (parsed.type === 'heartbeat') {
        broadcast(ws, { type: 'heartbeat', payload: { timestamp: Date.now() } });
        return;
      }

      if (parsed.type !== 'control') return;
      const result = ControlMessageSchema.safeParse(parsed);
      if (!result.success) {
        console.warn('[Mock WS] Rejected control frame:', result.error.format());
        return; // invalid control never mutates simulator state
      }
      const action = result.data.payload;

      if ('sensorId' in action && !SENSOR_IDS.has(action.sensorId)) {
        console.warn('[Mock WS] Control for unknown sensor:', action.sensorId);
        return;
      }

      switch (action.action) {
        case 'set_drift': {
          const name = SENSORS.find((s) => s.id === action.sensorId).name;
          const outcome = applyDriftSet(overlay, action.sensorId, action.offsetPct);
          if (outcome === 'noop') break; // 0 on an un-overlaid sensor changes nothing — no revision bump
          revision++;
          lastOverlayChangeAt = Date.now();
          operatorEvent(
            outcome === 'cleared'
              ? `Operator cleared overlay on ${name} (0% drift)`
              : `Operator overlay: ${name} set to ${action.offsetPct > 0 ? '+' : ''}${action.offsetPct}% of baseline`,
            outcome === 'cleared' || Math.abs(action.offsetPct) < 24 ? 'info' : 'warning'
          );
          break;
        }
        case 'clear_drift':
          delete overlay[action.sensorId];
          revision++;
          lastOverlayChangeAt = Date.now();
          operatorEvent(`Operator cleared overlay on ${action.sensorId}`, 'info');
          break;
        case 'set_offline':
          if (action.offline) offlineSet.add(action.sensorId);
          else offlineSet.delete(action.sensorId);
          revision++;
          lastOverlayChangeAt = Date.now();
          operatorEvent(
            `Operator marked ${action.sensorId} ${action.offline ? 'OFFLINE' : 'back online'}`,
            action.offline ? 'warning' : 'info'
          );
          break;
        case 'inject_malformed': {
          // Exactly one frame that the CLIENT must reject safely. Alternates
          // the two rejection paths: schema violation (Zod) and non-JSON
          // (parse catch) — one click each to exercise both (Prompt 9, S6).
          // NOTE: the "parse" payload must be SENT as raw text — broadcast()
          // JSON-stringifies, which would make it valid JSON (a string
          // literal) and both clicks would take the schema path instead.
          if (malformedKind === 'schema') {
            broadcast(ws, { type: 'telemetry', payload: [{ sensorId: 'ghost-99', value: 'not-a-number' }] });
          } else if (ws.readyState === 1) {
            ws.send('{"type": "telemetry", broken json');
          }
          operatorEvent(
            `Operator injected one malformed (${malformedKind}) frame — client should drop it`,
            'info'
          );
          malformedKind = malformedKind === 'schema' ? 'parse' : 'schema';
          break;
        }
        case 'reset_all': {
          for (const id of Object.keys(overlay)) delete overlay[id];
          offlineSet.clear();
          revision++;
          lastOverlayChangeAt = Date.now();
          operatorEvent('Operator overlay cleared — scenario cycle resumes', 'info');
          break;
        }
      }
    });
  });

  console.log(
    `[Mock WS] Server running on ws://localhost:${PORT} — scenario cycle ${SCENARIO_ENABLED ? 'ON (36s loop, pauses under operator control)' : 'OFF (raw random)'} · 13 message types + operator control frames`
  );
}

// Exported pure simulation helpers (tests import these — vitest does not
// trigger the listen guard above).
module.exports = {
  SENSORS,
  BASE_BY_ID,
  CYCLE_TICKS,
  phaseAt,
  generateBaselineSensors,
  generateTelemetry,
  applyOperatorState,
  applyDriftSet,
  generateDisagreement,
  generateConsensus,
  generateRisk,
  generateActionGate,
  generateOutliers,
  generateDriftState,
  consumersStoryFor,
};
