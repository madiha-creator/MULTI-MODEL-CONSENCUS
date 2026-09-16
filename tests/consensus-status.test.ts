/**
 * R1–R4 verdict rules (src/lib/consensus/status.ts) — the frontend's safety
 * display classification. These boundaries are what the whole demo hinges on,
 * so they get pinned down: every rule clause, both named constants, and the
 * trustedValue ⇔ refusal invariant the UI honesty rule depends on.
 */
import { describe, expect, it } from 'vitest';
import {
  RATIO_AGREE_MIN,
  RATIO_FAIL_MAX,
  deriveConsensusVerdict,
  type VerdictInput,
} from '@/lib/consensus/status';
import type { ActionGate, ConsensusState, Outlier, RiskAssessment } from '@/types/telemetry';

function consensus(over: Partial<ConsensusState> = {}): ConsensusState {
  return {
    trustedValue: 12.2,
    confidence: 0.95,
    agreementRatio: 1,
    contributingSensors: ['a', 'b', 'c', 'd', 'e', 'f'],
    excludedSensors: [],
    timestamp: 1,
    ...over,
  };
}
function risk(level: RiskAssessment['level']): RiskAssessment {
  return { level, score: { low: 5, medium: 25, high: 50, critical: 80 }[level], factors: [], affectedSensors: [], timestamp: 1 };
}
function outlier(sensorId = 'f'): Outlier {
  return { sensorId, sensorName: sensorId.toUpperCase(), deviation: 0.5, reason: 'Low confidence', flaggedAt: 1 };
}
function gate(state: ActionGate['state']): ActionGate {
  return { state, reason: 'test', triggeredBy: 'test', timestamp: 1 };
}
function input(over: Partial<VerdictInput> = {}): VerdictInput {
  return { consensus: consensus(), risk: risk('low'), outliers: [], actionGate: gate('ALLOW'), ...over };
}

describe('R1 — no data', () => {
  it('consensus null ⇒ NO_DATA, no trusted value', () => {
    const v = deriveConsensusVerdict(input({ consensus: null }));
    expect(v.verdict).toBe('NO_DATA');
    expect(v.trustedValue).toBeNull();
  });
});

describe('R2 — FAILED', () => {
  it('zero contributors ⇒ FAILED', () => {
    const v = deriveConsensusVerdict(input({ consensus: consensus({ contributingSensors: [], agreementRatio: 0 }) }));
    expect(v.verdict).toBe('FAILED');
    expect(v.trustedValue).toBeNull(); // refusal: UI must show UNKNOWN
  });
  it('ratio just below RATIO_FAIL_MAX ⇒ FAILED; at/above it ⇒ not FAILED', () => {
    expect(deriveConsensusVerdict(input({ consensus: consensus({ agreementRatio: RATIO_FAIL_MAX - 0.01 }) })).verdict).toBe('FAILED');
    expect(deriveConsensusVerdict(input({ consensus: consensus({ agreementRatio: RATIO_FAIL_MAX }) })).verdict).not.toBe('FAILED');
  });
  it('critical risk with >=2 outliers ⇒ FAILED; with 1 ⇒ not', () => {
    const two = deriveConsensusVerdict(input({ risk: risk('critical'), outliers: [outlier('e'), outlier('f')] }));
    expect(two.verdict).toBe('FAILED');
    const one = deriveConsensusVerdict(input({ risk: risk('critical'), outliers: [outlier('f')] }));
    expect(one.verdict).not.toBe('FAILED'); // still downgraded, but to DEGRADED (R3)
    expect(one.verdict).toBe('DEGRADED');
  });
});

describe('R3 — DEGRADED', () => {
  it('a single outlier ⇒ DEGRADED with the outlier named in the headline', () => {
    const v = deriveConsensusVerdict(input({ outliers: [outlier('f')] }));
    expect(v.verdict).toBe('DEGRADED');
    expect(v.headline).toContain('F');
    expect(v.trustedValue).not.toBeNull(); // degraded still trusts the agreeing sensors
  });
  it('ratio between the two floors ⇒ DEGRADED (the 0.83 scripted floor)', () => {
    expect(deriveConsensusVerdict(input({ consensus: consensus({ agreementRatio: 0.83 }) })).verdict).toBe('DEGRADED');
  });
  it('boundary just under RATIO_AGREE_MIN ⇒ DEGRADED; at it ⇒ AGREEMENT', () => {
    expect(deriveConsensusVerdict(input({ consensus: consensus({ agreementRatio: RATIO_AGREE_MIN - 0.01 }) })).verdict).toBe('DEGRADED');
    expect(deriveConsensusVerdict(input({ consensus: consensus({ agreementRatio: 0.95 }) })).verdict).toBe('AGREEMENT');
  });
  it('gate BLOCK with full agreement ⇒ DEGRADED', () => {
    expect(deriveConsensusVerdict(input({ actionGate: gate('BLOCK') })).verdict).toBe('DEGRADED');
  });
  it('excluded sensor with no outliers ⇒ DEGRADED', () => {
    const v = deriveConsensusVerdict(input({ consensus: consensus({ excludedSensors: ['f'], agreementRatio: 5 / 6 }) }));
    expect(v.verdict).toBe('DEGRADED');
    expect(v.excludedCount).toBe(1);
  });
});

describe('R4 — AGREEMENT', () => {
  it('all clear ⇒ AGREEMENT with the trusted value passed through', () => {
    const v = deriveConsensusVerdict(input());
    expect(v.verdict).toBe('AGREEMENT');
    expect(v.trustedValue).toBe(12.2);
    expect(v.label).toBe('AGREEMENT');
  });
});

describe('missing optional payloads', () => {
  it('null risk/actionGate can downgrade but never upgrade: ratio 0.33 ⇒ FAILED', () => {
    const v = deriveConsensusVerdict({ consensus: consensus({ agreementRatio: 0.33, contributingSensors: ['a', 'b'] }), risk: null, outliers: [], actionGate: null });
    expect(v.verdict).toBe('FAILED');
  });
  it('null risk with clean consensus ⇒ still AGREEMENT (accepted transient)', () => {
    expect(deriveConsensusVerdict({ consensus: consensus(), risk: null, outliers: [], actionGate: null }).verdict).toBe('AGREEMENT');
  });
});

describe('headline honesty', () => {
  it('FAILED headline counts contributing of total and refuses a value', () => {
    const v = deriveConsensusVerdict(input({ consensus: consensus({ agreementRatio: 0.33, contributingSensors: ['a', 'b'], excludedSensors: ['c', 'd', 'e', 'f'] }) }));
    expect(v.headline).toBe('Only 2 of 6 sensors agree (33%) — no trusted decision.');
    expect(v.trustedValue).toBeNull();
  });
});
