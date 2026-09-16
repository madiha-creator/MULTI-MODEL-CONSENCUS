import type { ActionGate, ConsensusState, Outlier, RiskAssessment } from '@/types/telemetry';

/**
 * Pure, frontend-side classification of the consensus pipeline's health —
 * the visualization layer for Prompt 5's three safety states. This is a
 * DISPLAY classification of live backend payload fields only; the backend's
 * own `action_gate` / `risk` messages remain the authoritative safety
 * signals rendered untouched by their panels. Nothing here hardcodes a
 * safety state: every verdict re-derives from the current payloads.
 */
export type ConsensusVerdict = 'NO_DATA' | 'AGREEMENT' | 'DEGRADED' | 'FAILED';

/** agreementRatio below this ⇒ the broker refuses to decide (FAILED). */
export const RATIO_FAIL_MAX = 0.5;
/** agreementRatio below this (with no other signal) ⇒ at least DEGRADED. */
export const RATIO_AGREE_MIN = 0.95;

export interface VerdictInput {
  consensus: ConsensusState | null;
  risk: RiskAssessment | null;
  outliers: Outlier[];
  actionGate: ActionGate | null;
}

/**
 * All fields are primitives on purpose: `useConsensusVerdict` shallow-compares
 * this object, and adding an array/field-by-reference here would silently
 * defeat memoization (new identity on every derivation → per-tick re-renders).
 */
export interface Verdict {
  verdict: ConsensusVerdict;
  /** Short uppercase word for badges/strip — 'AWAITING DATA' before first message. */
  label: string;
  /** One-sentence, judge-readable summary built from live numbers. */
  headline: string;
  /** null ⇔ FAILED or NO_DATA — UI must show UNKNOWN, never a stale value. */
  trustedValue: number | null;
  agreementPct: number;
  contributingCount: number;
  excludedCount: number;
}

/**
 * Rules are evaluated top-down, first match wins:
 *
 *  R1  consensus === null                                      → NO_DATA
 *  R2  nothing contributes, or agreementRatio < 0.5, or
 *      critical risk with ≥ 2 outliers                          → FAILED
 *  R3  any outlier/excluded sensor, ratio < 0.95, high/critical
 *      risk, or the gate says BLOCK                            → DEGRADED
 *  R4  otherwise                                                → AGREEMENT
 *
 * A null `risk`/`actionGate` can only fail its R2/R3 clauses, so it can
 * downgrade but never upgrade a verdict — the worst transient is one paint
 * of AGREEMENT before a downgrade at 1 Hz, which is accepted. Staleness
 * detection is deferred: the WS contract carries no staleness field and this
 * function must stay deterministic (no Date.now()); transport loss is already
 * surfaced by connectionState / ReconnectBanner.
 */
export function deriveConsensusVerdict(input: VerdictInput): Verdict {
  const { consensus, risk, outliers, actionGate } = input;

  if (!consensus) {
    return {
      verdict: 'NO_DATA',
      label: 'AWAITING DATA',
      headline: 'No consensus data received yet.',
      trustedValue: null,
      agreementPct: 0,
      contributingCount: 0,
      excludedCount: 0,
    };
  }

  const ratio = consensus.agreementRatio;
  const agreementPct = Math.round(ratio * 100);
  const counts = {
    agreementPct,
    contributingCount: consensus.contributingSensors.length,
    excludedCount: consensus.excludedSensors.length,
  };

  const failed =
    consensus.contributingSensors.length === 0 ||
    ratio < RATIO_FAIL_MAX ||
    (risk?.level === 'critical' && outliers.length >= 2);

  if (failed) {
    return {
      verdict: 'FAILED',
      label: 'CONSENSUS FAILED',
      headline:
        `Only ${counts.contributingCount} of ${counts.contributingCount + counts.excludedCount} ` +
        `sensors agree (${agreementPct}%) — no trusted decision.`,
      trustedValue: null,
      ...counts,
    };
  }

  const degraded =
    outliers.length > 0 ||
    counts.excludedCount > 0 ||
    ratio < RATIO_AGREE_MIN ||
    risk?.level === 'high' ||
    risk?.level === 'critical' ||
    actionGate?.state === 'BLOCK';

  if (degraded) {
    const outlierNames = outliers.map((o) => o.sensorName).join(', ');
    return {
      verdict: 'DEGRADED',
      label: 'DEGRADED',
      headline: outlierNames
        ? `Outlier excluded: ${outlierNames} — trusted state from ${counts.contributingCount} agreeing sensors.`
        : `Agreement ${agreementPct}% below full consensus — action safety-controlled.`,
      trustedValue: consensus.trustedValue,
      ...counts,
    };
  }

  return {
    verdict: 'AGREEMENT',
    label: 'AGREEMENT',
    headline: `All ${counts.contributingCount} sensors agree (${agreementPct}%).`,
    trustedValue: consensus.trustedValue,
    ...counts,
  };
}

/**
 * Style tokens per verdict. Values are plain strings so this module never
 * imports UI code (lib/ file-boundary rule). badgeVariant is structurally
 * compatible with ui/Badge's variant union without importing it.
 */
export const verdictStyles: Record<
  ConsensusVerdict,
  {
    badgeVariant: 'default' | 'success' | 'warning' | 'error';
    textClass: string;
    bgClass: string;
    borderClass: string;
    /** Raw color for SVG props (StateMesh). */
    hex: string;
    /** CSS custom property for Tailwind arbitrary values. */
    cssVar: string;
  }
> = {
  NO_DATA: {
    badgeVariant: 'default',
    textClass: 'text-[var(--color-text-muted)]',
    bgClass: 'bg-[var(--color-bg-secondary)]',
    borderClass: 'border-[var(--color-border)]',
    hex: '#94a3b8',
    cssVar: 'var(--color-text-muted)',
  },
  AGREEMENT: {
    badgeVariant: 'success',
    textClass: 'text-[var(--color-risk-low)]',
    bgClass: 'bg-[#22c55e]/5',
    borderClass: 'border-[#22c55e]/30',
    hex: '#22c55e',
    cssVar: 'var(--color-risk-low)',
  },
  DEGRADED: {
    badgeVariant: 'warning',
    textClass: 'text-[var(--color-risk-medium)]',
    bgClass: 'bg-[#f59e0b]/5',
    borderClass: 'border-[#f59e0b]/40',
    hex: '#f59e0b',
    cssVar: 'var(--color-risk-medium)',
  },
  FAILED: {
    badgeVariant: 'error',
    textClass: 'text-[var(--color-risk-critical)]',
    bgClass: 'bg-[#ef4444]/10',
    borderClass: 'border-[#ef4444]/50',
    hex: '#ef4444',
    cssVar: 'var(--color-risk-critical)',
  },
};
