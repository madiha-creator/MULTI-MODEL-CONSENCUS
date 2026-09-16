/**
 * The simulator's operator-overlay math (scripts/mock-ws-server.js) — the
 * backend half of Prompt 7's "no faking" guarantee. These tests exercise the
 * REAL exported helpers the running server uses each tick, with jitter-free
 * fixtures: a drift offset must flow through disagreement → consensus →
 * outliers → risk → gate as a genuine pipeline consequence, and the drift
 * readout must be a measurement, not noise.
 *
 * The mock is CJS; vitest interops it via the default-style require below.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveConsensusVerdict } from '@/lib/consensus/status';

const require = createRequire(import.meta.url);
const mock = require(
  fileURLToPath(new URL('../scripts/mock-ws-server.js', import.meta.url))
) as {
  SENSORS: { id: string; unit: string; baseValue: number; name: string; type: string }[];
  BASE_BY_ID: Record<string, number>;
  CYCLE_TICKS: number;
  phaseAt: (tick: number) => { name: 'AGREEMENT' | 'DEGRADED' | 'FAILED'; i: number };
  applyOperatorState: (
    sensors: Fixture[],
    overlay: Record<string, number>,
    offlineSet: Set<string>,
  ) => Fixture[];
  applyDriftSet: (
    overlay: Record<string, number>,
    sensorId: string,
    offsetPct: number,
  ) => 'set' | 'cleared' | 'noop';
  generateDisagreement: (s: Fixture[]) => { isDisagreeing: boolean; sensorPair: string[] }[];
  generateConsensus: (s: Fixture[]) => {
    trustedValue: number;
    confidence: number;
    agreementRatio: number;
    contributingSensors: string[];
    excludedSensors: string[];
    timestamp: number;
  };
  generateRisk: (
    s: Fixture[],
    d: { isDisagreeing: boolean }[],
    c: { agreementRatio: number; excludedSensors: string[] },
  ) => { level: 'low' | 'medium' | 'high' | 'critical'; score: number; factors: string[]; affectedSensors: string[]; timestamp: number };
  generateActionGate: (
    r: { level: string; factors: string[] },
    c: { agreementRatio: number },
    o: unknown[],
  ) => { state: 'ALLOW' | 'HOLD' | 'BLOCK'; reason: string; triggeredBy: string; timestamp: number };
  generateOutliers: (s: Fixture[]) => { sensorId: string }[];
  generateDriftState: (
    s: Fixture[],
    overlay: Record<string, number>,
    last: number,
  ) => { magnitude: number; direction: string; affectedSensors: string[]; lastCorrection: number };
  consumersStoryFor: (c: { agreementRatio: number }) => { name: string };
};

interface Fixture {
  sensorId: string;
  sensorName?: string;
  unit?: string;
  value: number;
  confidence: number;
  status: string;
}

/** Deterministic healthy fleet at exact baselines — no rand() anywhere. */
function fleet(): Fixture[] {
  return mock.SENSORS.map((s) => ({
    sensorId: s.id,
    sensorName: s.name,
    unit: s.unit,
    value: s.baseValue,
    confidence: 0.95,
    status: 'normal',
  }));
}

/** Full downstream chain, mirroring the server's tick order. */
function chain(sensors: Fixture[]) {
  const disagreement = mock.generateDisagreement(sensors);
  const consensus = mock.generateConsensus(sensors);
  const outliers = mock.generateOutliers(sensors);
  const risk = mock.generateRisk(sensors, disagreement, consensus);
  const gate = mock.generateActionGate(risk, consensus, outliers);
  return { consensus, outliers, risk, gate };
}

describe('phaseAt — scripted 36-tick cycle', () => {
  it('cycle length is 36 ticks (20 agree / 10 degraded / 6 failed)', () => {
    expect(mock.CYCLE_TICKS).toBe(36);
  });
  it('phase boundaries at ticks 19/20/29/30/35/36', () => {
    expect(mock.phaseAt(0)).toEqual({ name: 'AGREEMENT', i: 0 });
    expect(mock.phaseAt(19)).toEqual({ name: 'AGREEMENT', i: 19 });
    expect(mock.phaseAt(20)).toEqual({ name: 'DEGRADED', i: 0 });
    expect(mock.phaseAt(29)).toEqual({ name: 'DEGRADED', i: 9 });
    expect(mock.phaseAt(30)).toEqual({ name: 'FAILED', i: 0 });
    expect(mock.phaseAt(35)).toEqual({ name: 'FAILED', i: 5 });
  });
  it('wraps continuously (tick 36 == tick 0, tick 90 mid-cycle)', () => {
    expect(mock.phaseAt(36)).toEqual({ name: 'AGREEMENT', i: 0 });
    expect(mock.phaseAt(55)).toEqual({ name: 'AGREEMENT', i: 19 });
    expect(mock.phaseAt(90)).toEqual({ name: 'AGREEMENT', i: 18 });
  });
});

describe('applyOperatorState — drift overlay (the Prompt 7 math)', () => {
  it('+40% on lidar-01: value = base*1.4 exactly, confidence crosses the 0.6 floor, status critical', () => {
    const [lidar] = mock
      .applyOperatorState(fleet(), { 'lidar-01': 40 }, new Set())
      .filter((s) => s.sensorId === 'lidar-01');
    expect(lidar.value).toBe(17.22); // 12.3 * 1.4
    expect(lidar.confidence).toBe(0.35); // 0.95 − 40*0.015
    expect(lidar.status).toBe('critical');
  });
  it('a small offset stays above the contributing floor (warning, not critical)', () => {
    const [temp] = mock
      .applyOperatorState(fleet(), { 'temp-01': 5 }, new Set())
      .filter((s) => s.sensorId === 'temp-01');
    expect(temp.value).toBe(44.1); // 42 * 1.05
    expect(temp.confidence).toBe(0.88);
    expect(temp.status).toBe('warning');
  });
  it('negative offset decays confidence on |pct| and reads low', () => {
    const [imu] = mock
      .applyOperatorState(fleet(), { 'imu-01': -30 }, new Set())
      .filter((s) => s.sensorId === 'imu-01');
    expect(imu.value).toBe(0.35); // 0.5 * 0.7
    expect(imu.confidence).toBe(0.5);
    expect(imu.status).toBe('critical');
  });
  it('offline: value 0, confidence 0, status offline — regardless of overlay', () => {
    const [gyro] = mock
      .applyOperatorState(fleet(), { 'gyro-01': 20 }, new Set(['gyro-01']))
      .filter((s) => s.sensorId === 'gyro-01');
    expect(gyro).toMatchObject({ value: 0, confidence: 0, status: 'offline' });
  });
});

describe('the pipeline genuinely reacts to an operator drift (no faking)', () => {
  it('+40% lidar-01 flows through: excluded from consensus, flagged outlier, risk high, gate BLOCK', () => {
    const { consensus, outliers, risk, gate } = chain(
      mock.applyOperatorState(fleet(), { 'lidar-01': 40 }, new Set()),
    );
    expect(consensus.excludedSensors).toEqual(['lidar-01']);
    expect(consensus.contributingSensors).toHaveLength(5);
    expect(consensus.agreementRatio).toBe(0.83); // 5/6 — the DEGRADED floor
    expect(outliers.map((o) => o.sensorId)).toEqual(['lidar-01']);
    expect(risk.level).toBe('high');
    expect(gate.state).toBe('BLOCK');
  });
  it('trusted value is the mean of contributing sensors only — the drifted reading never enters it', () => {
    const drifted = chain(mock.applyOperatorState(fleet(), { 'lidar-01': 40 }, new Set())).consensus;
    expect(drifted.excludedSensors).toContain('lidar-01');
    // Re-derive the mean over the contributing set and demand an exact match:
    // if the 17.22 reading had leaked in, this number would be off.
    const expected =
      mock.SENSORS.filter((s) => drifted.contributingSensors.includes(s.id)).reduce(
        (sum, s) => sum + s.baseValue,
        0,
      ) / drifted.contributingSensors.length;
    expect(drifted.trustedValue).toBeCloseTo(expected, 2);
  });
  it('healthy fleet: full ratio, no outliers, ALLOW — the baseline the overlay breaks', () => {
    const { consensus, outliers, gate } = chain(fleet());
    expect(consensus.agreementRatio).toBe(1);
    expect(outliers).toHaveLength(0);
    expect(gate.state).toBe('ALLOW');
  });
});

describe('offline shrinks the electorate honestly', () => {
  it('offline sensor: excluded from the ratio denominator, not an outlier, still ALLOW', () => {
    const { consensus, outliers, gate } = chain(
      mock.applyOperatorState(fleet(), {}, new Set(['gyro-01'])),
    );
    expect(consensus.contributingSensors).toHaveLength(5);
    expect(consensus.excludedSensors).toEqual([]); // absent ≠ excluded
    expect(consensus.agreementRatio).toBe(1); // 5/5, honest denominator
    expect(outliers).toHaveLength(0); // "absent" is not "low-confidence"
    expect(gate.state).toBe('ALLOW');
  });
  it('offline pair generates no disagreement entries', () => {
    const sensors = mock.applyOperatorState(fleet(), {}, new Set(['gyro-01']));
    const pairs = mock.generateDisagreement(sensors);
    expect(pairs.every((p) => !p.sensorPair.includes('gyro-01'))).toBe(true);
  });
  it('total blackout: ratio 0 with no NaN, zero contributors', () => {
    const { consensus } = chain(
      mock.applyOperatorState(fleet(), {}, new Set(mock.SENSORS.map((s) => s.id))),
    );
    expect(consensus.agreementRatio).toBe(0);
    expect(Number.isNaN(consensus.agreementRatio)).toBe(false);
    expect(consensus.contributingSensors).toHaveLength(0);
  });
});

describe('generateDriftState — measured, not random', () => {
  it('magnitude = worst deviation vs baseline; direction = its sign; affected = overlay keys', () => {
    const sensors = mock.applyOperatorState(fleet(), { 'lidar-01': 40 }, new Set());
    const ds = mock.generateDriftState(sensors, { 'lidar-01': 40 }, 123);
    expect(ds.magnitude).toBe(0.4); // measured: 17.22/12.3 − 1
    expect(ds.direction).toBe('positive');
    expect(ds.affectedSensors).toEqual(['lidar-01']);
    expect(ds.lastCorrection).toBe(123);
  });
  it('negative drift reads negative at its magnitude', () => {
    const sensors = mock.applyOperatorState(fleet(), { 'imu-01': -30 }, new Set());
    const ds = mock.generateDriftState(sensors, { 'imu-01': -30 }, 1);
    expect(ds.magnitude).toBe(0.3);
    expect(ds.direction).toBe('negative');
  });
  it('healthy fleet: direction none — measurement, not decoration', () => {
    const ds = mock.generateDriftState(fleet(), {}, 1);
    expect(ds.magnitude).toBeLessThan(0.02);
    expect(ds.direction).toBe('none');
    expect(ds.affectedSensors).toEqual([]);
  });
  it('offline sensors never register as drift', () => {
    const sensors = mock.applyOperatorState(fleet(), {}, new Set(['gyro-01'])); // value 0 vs base 1200
    const ds = mock.generateDriftState(sensors, {}, 1);
    expect(ds.magnitude).toBeLessThan(0.02);
  });
});

describe('consumersStoryFor — bus story tracks the real ratio', () => {
  it('maps ratio floors to the three states', () => {
    expect(mock.consumersStoryFor({ agreementRatio: 1 }).name).toBe('AGREEMENT');
    expect(mock.consumersStoryFor({ agreementRatio: 0.83 }).name).toBe('DEGRADED');
    expect(mock.consumersStoryFor({ agreementRatio: 0.33 }).name).toBe('FAILED');
  });
});

describe('applyDriftSet — the server-side set_drift mutation', () => {
  it('0% drift CLEARS instead of recording — a 0 entry would freeze the scripted cycle while nothing drifted', () => {
    const overlay: Record<string, number> = { 'lidar-01': 30 };
    expect(mock.applyDriftSet(overlay, 'lidar-01', 0)).toBe('cleared');
    expect(Object.keys(overlay)).toEqual([]);
  });
  it('0% on an un-overlaid sensor is a pure noop (no revision churn)', () => {
    const overlay: Record<string, number> = {};
    expect(mock.applyDriftSet(overlay, 'temp-01', 0)).toBe('noop');
    expect(Object.keys(overlay)).toEqual([]);
  });
  it('nonzero records normally', () => {
    const overlay: Record<string, number> = {};
    expect(mock.applyDriftSet(overlay, 'temp-01', -25)).toBe('set');
    expect(overlay).toEqual({ 'temp-01': -25 });
  });
});

describe('README demo step "three sensors at +40% ⇒ FAILED" — controls alone can reach refusal', () => {
  it('3 drifted criticals: ≥2 outliers + critical risk, gate BLOCK — and the frontend verdict says FAILED', () => {
    const overlay = { 'lidar-01': 40, 'temp-01': 40, 'gyro-01': 40 };
    const { consensus, outliers, risk, gate } = chain(mock.applyOperatorState(fleet(), overlay, new Set()));
    expect(outliers.map((o) => o.sensorId)).toHaveLength(3);
    expect(risk.level).toBe('critical');
    expect(gate.state).toBe('BLOCK');
    // Feed the REAL backend payloads through the frontend's verdict rules:
    expect(
      deriveConsensusVerdict({
        consensus: { ...consensus, timestamp: 1 },
        risk: { ...risk, timestamp: 1 },
        outliers: outliers.map((o) => ({
          sensorId: o.sensorId,
          sensorName: mock.SENSORS.find((s) => s.id === o.sensorId)!.name,
          deviation: 0.4,
          reason: 'Critical reading',
          flaggedAt: 1,
        })),
        actionGate: { ...gate, timestamp: 1 },
      }),
    ).toMatchObject({ verdict: 'FAILED', trustedValue: null });
  });
});

