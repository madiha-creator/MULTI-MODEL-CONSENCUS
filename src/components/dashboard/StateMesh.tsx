'use client';

/**
 * StateMesh — the infrastructure pipeline view:
 *
 *   SENSORS ──feed──▶ CONSENSUS BROKER ──▶ TRUSTED STATE ──bus──▶ AI AGENTS
 *
 * Left-to-right flow, one column per stage of the conceptual architecture.
 * Every mark on this canvas encodes a live signal (1 Hz WebSocket):
 *
 *  - Sensor feed edges: green = streaming into the broker; gray dashed =
 *    offline; red dashed + faded node = excluded outlier (same EXCLUDED
 *    language as SensorGrid); red pulse overlay = in a disagreeing pair.
 *    (The old sensor↔sensor disagreement lines were retired — a bad reading
 *    matters at the feed that carries it into the broker, directionally.)
 *  - Broker: rounded box wearing the consensus verdict's color, with a
 *    one-shot pulse ring per consensus frame = "still processing".
 *  - Trusted state: the visually heaviest element (2.25px verdict-hex border,
 *    mono value) — it is the pipeline's product, not another node. Shows
 *    UNKNOWN in red whenever the Verdict refuses a value (FAILED/NO_DATA),
 *    never a stale number (status.ts honesty rule, via v.trustedValue).
 *  - Agent edges/nodes: active = streaming packets + value; stale = flowing
 *    but faded amber ("data moving, going bad"); held = broker withholding;
 *    offline = off the bus. consumedValue null ⇒ the UI shows no number.
 *
 * Packets are zero-length round-cap dashes marching along each edge's
 * baseline path (`.pipeline-flow` in globals.css) — pure CSS, no
 * framer-motion and no rAF loop, per the dashboard's house style. Path `d`
 * strings depend only on topology (node ids/order), never on per-tick values,
 * so React patches attributes each tick without unmounting any edge element
 * and animation clocks keep running. Transport loss freezes the mesh via a
 * `pipeline-paused` class and dims content under `pipeline-dim`.
 */

import type { ReactNode } from 'react';
import type { AgentDecision, AgentState, SensorReading } from '@/types/telemetry';
import {
  useAgents,
  useAgentRound,
  useConnectionState,
  useConsensus,
  useConsensusVerdict,
  useDisagreements,
  useSensors,
} from '@/hooks/useTelemetry';
import { verdictStyles } from '@/lib/consensus/status';
import { ROUND_STALE_MS } from '@/hooks/useAgentBusRounds';
import { Card } from '@/components/ui/Card';
import { LiveIndicator } from '@/components/ui/LiveIndicator';

// ── Geometry (viewBox units; the SVG scales responsively via w-full) ────────
const W = 1000;
const H = 360;
const BCY = 180; // pipeline centerline (broker & trusted state sit on it)

const SX = 96; // sensor node centre x
const SENSOR_R = 13;
const SEN_TOP = 64;
const SEN_BOT = 300;

const BX = 336; // broker rect
const BW = 112;
const BH = 68;
const BCX = BX + BW / 2;

const TX = 554; // trusted-state rect — deliberately the biggest box
const TW = 136;
const TH = 84;
const TCX = TX + TW / 2;

const AX = 812; // agent rect left edge
const AW = 136;
const AH = 54;
const ACX = AX + AW / 2;
const AG_TOP = 82;
const AG_BOT = 278;

/** Even vertical spread that survives the list growing. */
function rowY(i: number, n: number, top: number, bot: number): number {
  return n <= 1 ? (top + bot) / 2 : top + (i * (bot - top)) / (n - 1);
}

/** Feed-edge convergence points, spread down the broker's left edge. */
function convergeY(i: number, n: number): number {
  return n <= 1 ? BCY : 154 + (i * 52) / (n - 1);
}

const FEED_EDGE_D = (ys: number, ya: number) =>
  `M ${SX + SENSOR_R + 2} ${ys} C 180 ${ys}, 258 ${ya}, ${BX - 2} ${ya}`;
const BROKER_TO_TRUSTED_D = `M ${BX + BW + 2} ${BCY} C 492 ${BCY}, 512 ${BCY}, ${TX - 2} ${BCY}`;
const BUS_EDGE_D = (yc: number) =>
  `M ${TX + TW + 2} ${BCY} C ${TX + TW + 50} ${BCY}, ${AX - 42} ${yc}, ${AX - 2} ${yc}`;

// ── Color tables (SVG attributes can't take Tailwind classes) ───────────────
// Sensor status colors are the mesh's own raw map (mirrors Tailwind palette
// tokens); downstream verdict colors always come from verdictStyles.hex —
// the documented SVG color API — never a forked table.
const SENSOR_STATUS_HEX: Record<SensorReading['status'], string> = {
  normal: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  offline: '#4b5568',
};

const AGENT_STATUS_HEX: Record<AgentState['status'], string> = {
  active: '#22c55e',
  stale: '#f59e0b',
  held: '#64748b',
  offline: '#4b5568',
};

const STREAM_GREEN = '#22c55e';
const RED = '#ef4444';
const GRAY = '#4b5568';

// ── Feed edge semantics ─────────────────────────────────────────────────────
type FeedKind = 'offline' | 'excluded' | 'streaming';

function feedKind(s: SensorReading, excluded: boolean): FeedKind {
  if (s.status === 'offline') return 'offline';
  if (excluded) return 'excluded';
  return 'streaming';
}

type BusKind = 'held' | 'stale' | 'active' | 'offline';

function agentLine(a: AgentState, propagating: boolean): string {
  if (!propagating) {
    if (a.status === 'active') return 'AWAITING TRUSTED STATE';
    if (a.status === 'stale') return 'STALE · —';
    return a.status === 'held' ? 'HELD · —' : 'OFFLINE';
  }
  switch (a.status) {
    case 'active':
      return `${a.consumedValue !== null ? a.consumedValue.toFixed(2) : '—'} · FRESH`;
    case 'stale':
      return `${a.consumedValue !== null ? a.consumedValue.toFixed(2) : '—'} · LATE`;
    case 'held':
      return 'HELD · —';
    case 'offline':
      return 'OFFLINE';
  }
}

export function StateMesh() {
  const sensors = useSensors();
  const disagreements = useDisagreements();
  const consensus = useConsensus();
  const v = useConsensusVerdict();
  const agents = useAgents();
  const agentRound = useAgentRound();
  const connectionState = useConnectionState();

  // Join LLM decisions (REST) onto wire statuses (WS) by agentId. A round
  // is only fresh enough to trust while the broker still publishes a
  // trusted value; FAILED ⇒ withhold (the client engine skipped it).
  // ROUND_STALE_MS matches AgentConsensusPanel — mesh badges must not outlive
  // the panel's own staleness clock by painting decisions from an old round.
  const decisionByAgent = new Map<string, AgentDecision>();
  if (
    agentRound &&
    agentRound.configured &&
    v.trustedValue !== null &&
    Date.now() - agentRound.finishedAt <= ROUND_STALE_MS
  ) {
    for (const d of agentRound.decisions) decisionByAgent.set(d.agentId, d);
  }

  const live = connectionState === 'connected';
  const vHex = verdictStyles[v.verdict].hex;

  // Set membership per tick — O(n), rebuilt cheaply; keys stay stable.
  const excluded = new Set(consensus?.excludedSensors ?? []);
  const alerting = new Set(
    disagreements.filter((d) => d.isDisagreeing).flatMap((d) => d.sensorPair)
  );
  // The broker produces a trusted value ⇔ its verdict hasn't refused one.
  // Broker→bus and bus→agent flow all key off this single honest signal.
  const trustedOut = live && v.trustedValue !== null;

  const header = (text: string, x: number) => (
    <text
      x={x}
      y={26}
      textAnchor="middle"
      fontSize={9}
      fontWeight={600}
      letterSpacing={1.5}
      fill="var(--color-text-muted)"
    >
      {text}
    </text>
  );

  return (
    <Card
      title="StateMesh — Sensor → Broker → Trusted State → Agents"
      badge={<LiveIndicator connected={live} />}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={live ? 'w-full' : 'w-full pipeline-paused'}
        role="img"
        aria-label="Consensus pipeline: sensors feeding the broker, trusted state propagating to AI agents"
        style={{ minHeight: 160 }}
      >
        {/* Column headers sit outside the dim group: the skeleton stays
            readable when the transport drops. */}
        {header('SENSORS', SX)}
        {header('CONSENSUS BROKER', BCX)}
        {header('TRUSTED STATE', TCX)}
        {header('AI AGENTS', ACX)}

        <g className={live ? undefined : 'pipeline-dim'}>
          {sensors.length === 0 ? (
            <text
              x={W / 2}
              y={BCY}
              textAnchor="middle"
              fontSize={10}
              letterSpacing={1.5}
              fill="var(--color-text-muted)"
            >
              AWAITING TELEMETRY…
            </text>
          ) : (
            <g>
              {/* ── Sensor feed edges (under nodes) ── */}
              {sensors.map((s, i) => {
                const ys = rowY(i, sensors.length, SEN_TOP, SEN_BOT);
                const d = FEED_EDGE_D(ys, convergeY(i, sensors.length));
                const kind = feedKind(s, excluded.has(s.sensorId));
                const isAlert = kind === 'streaming' && alerting.has(s.sensorId);
                return (
                  <g key={`feed-${s.sensorId}`}>
                    {kind === 'streaming' && (
                      <path d={d} fill="none" stroke={STREAM_GREEN} strokeWidth={1.25} strokeOpacity={0.16} />
                    )}
                    {kind === 'offline' && (
                      <path d={d} fill="none" stroke={GRAY} strokeWidth={1.25} strokeDasharray="3 4" strokeOpacity={0.5} />
                    )}
                    {kind === 'excluded' && (
                      <path d={d} fill="none" stroke={RED} strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.55} />
                    )}
                    {kind === 'streaming' && (
                      <path key={`flow-${s.sensorId}`} d={d} className="pipeline-flow" fill="none" stroke={STREAM_GREEN} strokeWidth={3.5} />
                    )}
                    {isAlert && (
                      <path d={d} className="pipeline-alert" fill="none" stroke={RED} strokeWidth={2} />
                    )}
                  </g>
                );
              })}

              {/* ── Broker → Trusted State ── */}
              {trustedOut ? (
                <>
                  <path d={BROKER_TO_TRUSTED_D} fill="none" stroke={vHex} strokeWidth={1.25} strokeOpacity={0.18} />
                  <path d={BROKER_TO_TRUSTED_D} className="pipeline-flow" fill="none" stroke={vHex} strokeWidth={4} />
                </>
              ) : (
                <path d={BROKER_TO_TRUSTED_D} fill="none" stroke={GRAY} strokeWidth={1.25} strokeDasharray="3 4" strokeOpacity={0.5} />
              )}

              {/* ── Trusted State → agent bus edges ── */}
              {agents.map((a, i) => {
                const yc = rowY(i, agents.length, AG_TOP, AG_BOT);
                const d = BUS_EDGE_D(yc);
                const flows = trustedOut && (a.status === 'active' || a.status === 'stale');
                return (
                  <g key={`bus-${a.agentId}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={flows ? vHex : GRAY}
                      strokeWidth={1.25}
                      strokeOpacity={flows ? 0.18 : a.status === 'offline' ? 0.3 : 0.5}
                      strokeDasharray={flows ? undefined : '3 4'}
                    />
                    {flows && (
                      <path
                        d={d}
                        className="pipeline-flow"
                        fill="none"
                        stroke={vHex}
                        strokeWidth={3.5}
                        strokeOpacity={a.status === 'stale' ? 0.4 : 1}
                      />
                    )}
                  </g>
                );
              })}

              {/* ── Sensor nodes ── */}
              {sensors.map((s, i) => {
                const ys = rowY(i, sensors.length, SEN_TOP, SEN_BOT);
                const hex = SENSOR_STATUS_HEX[s.status];
                const isExcluded = excluded.has(s.sensorId);
                return (
                  <g key={`sen-${s.sensorId}`} opacity={isExcluded ? 0.4 : 1}>
                    <text x={SX - SENSOR_R - 7} y={ys - 2} textAnchor="end" fontSize={9.5} fill="var(--color-text-secondary)">
                      {s.sensorName}
                    </text>
                    <text
                      x={SX - SENSOR_R - 7}
                      y={ys + 10}
                      textAnchor="end"
                      fontSize={8}
                      fontFamily="Geist Mono, monospace"
                      fill="var(--color-text-muted)"
                    >
                      {Math.round(s.confidence * 100)}%
                    </text>
                    <circle cx={SX} cy={ys} r={SENSOR_R} fill={hex} fillOpacity={0.12} stroke={hex} strokeWidth={1.5} strokeDasharray={isExcluded ? '3 3' : undefined} />
                    <circle cx={SX} cy={ys} r={4} fill={hex} />
                  </g>
                );
              })}

              {/* ── Broker ── */}
              <g>
                {live && consensus && (
                  <rect
                    key={consensus.timestamp}
                    x={BX - 5}
                    y={BCY - BH / 2 - 5}
                    width={BW + 10}
                    height={BH + 10}
                    rx={12}
                    fill="none"
                    stroke={vHex}
                    strokeWidth={1.5}
                    className="pipeline-node-pulse"
                  />
                )}
                <rect
                  x={BX}
                  y={BCY - BH / 2}
                  width={BW}
                  height={BH}
                  rx={10}
                  fill={vHex}
                  fillOpacity={0.08}
                  stroke={vHex}
                  strokeWidth={1.5}
                />
                <text x={BCX} y={BCY - 5} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-text-primary)">
                  BROKER
                </text>
                <text x={BCX} y={BCY + 14} textAnchor="middle" fontSize={8} fontWeight={700} letterSpacing={0.5} fill={vHex}>
                  {v.verdict === 'NO_DATA' ? 'AWAITING' : v.verdict}
                </text>
              </g>

              {/* ── Trusted State — the pipeline's product: largest,
                  thickest-bordered element ── */}
              <g>
                <rect
                  x={TX}
                  y={BCY - TH / 2}
                  width={TW}
                  height={TH}
                  rx={10}
                  fill={vHex}
                  fillOpacity={0.06}
                  stroke={vHex}
                  strokeWidth={2.25}
                />
                <text
                  x={TCX}
                  y={BCY - 7}
                  textAnchor="middle"
                  fontFamily="Geist Mono, monospace"
                  fontSize={v.trustedValue === null ? 15 : 20}
                  fontWeight={700}
                  fill={v.trustedValue === null ? RED : 'var(--color-text-primary)'}
                >
                  {v.trustedValue === null ? 'UNKNOWN' : v.trustedValue.toFixed(2)}
                </text>
                <text x={TCX} y={BCY + 8} textAnchor="middle" fontSize={6.5} letterSpacing={0.8} fill="var(--color-text-muted)">
                  TRUSTED VALUE · UNITLESS DEMO
                </text>
                <text
                  x={TCX}
                  y={BCY + 25}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="Geist Mono, monospace"
                  fill="var(--color-text-secondary)"
                >
                  {consensus
                    ? `conf ${Math.round(consensus.confidence * 100)}% · ${consensus.contributingSensors.length}/${sensors.length}`
                    : '—'}
                </text>
              </g>

              {/* ── Agents ── */}
              {agents.length === 0 ? (
                <text x={ACX} y={BCY} textAnchor="middle" fontSize={8} letterSpacing={1} fill="var(--color-text-muted)">
                  NO CONSUMERS CONNECTED
                </text>
              ) : (
                agents.map((a, i) => {
                  const yc = rowY(i, agents.length, AG_TOP, AG_BOT);
                  const hex = AGENT_STATUS_HEX[a.status];
                  const dash =
                    a.status === 'stale' ? '5 3' : a.status === 'held' || a.status === 'offline' ? '3 3' : undefined;
                  const decision = decisionByAgent.get(a.agentId);
                  const decisionHex = decision
                    ? decision.error !== null
                      ? '#64748b'
                      : decision.decision === 'PROCEED'
                        ? '#22c55e'
                        : decision.decision === 'CAUTION'
                          ? '#f59e0b'
                          : '#94a3b8'
                    : null;
                  return (
                    <g key={`agent-${a.agentId}`} opacity={a.status === 'offline' ? 0.4 : 1}>
                      <rect
                        x={AX}
                        y={yc - AH / 2}
                        width={AW}
                        height={AH}
                        rx={8}
                        fill={hex}
                        fillOpacity={0.05}
                        stroke={a.status === 'active' ? 'var(--color-accent)' : hex}
                        strokeOpacity={a.status === 'active' ? 0.35 : 0.6}
                        strokeWidth={1}
                        strokeDasharray={dash}
                      />
                      <circle cx={AX + 13} cy={yc - 16} r={3.5} fill={hex} />
                      <text x={AX + 23} y={yc - 12.5} fontSize={9.5} fill="var(--color-text-secondary)">
                        {a.agentName}
                      </text>
                      <text
                        x={AX + 13}
                        y={yc + 2}
                        fontSize={8}
                        fontFamily="Geist Mono, monospace"
                        fill={a.status === 'active' && trustedOut ? 'var(--color-text-primary)' : hex}
                      >
                        {agentLine(a, trustedOut)}
                      </text>
                      {/* LLM decision line — only painted when a fresh round
                          joined to this agent exists; provider failures mark
                          NO-DECISION, never a fake verdict. */}
                      {decision && (
                        <text
                          x={AX + 13}
                          y={yc + 17}
                          fontSize={8}
                          fontWeight={700}
                          fontFamily="Geist Mono, monospace"
                          fill={decisionHex ?? 'var(--color-text-muted)'}
                        >
                          {decision.error !== null
                            ? 'NO-DECISION'
                            : `${decision.decision} ${Math.round(decision.confidence * 100)}%`}
                        </text>
                      )}
                      {decision && decision.error === null && (
                        <rect
                          x={AX}
                          y={yc - AH / 2}
                          width={3}
                          height={AH}
                          rx={1.5}
                          fill={decisionHex ?? 'transparent'}
                        />
                      )}
                    </g>
                  );
                })
              )}
            </g>
          )}
        </g>
      </svg>

      {/* Legend — plain DOM row; reuses the same color tables as the canvas. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-[var(--color-text-secondary)]">
        <Swatch line={<><Dot s={STREAM_GREEN} /><Dot s={STREAM_GREEN} /></>} label="streaming" />
        <Swatch line={<Dash s={GRAY} />} label="offline" />
        <Swatch line={<Dash s={RED} />} label="excluded outlier" />
        <Swatch line={<path d="M0 3 H16" stroke={RED} strokeWidth={2} strokeOpacity={0.8} />} label="disagreement" />
        <Swatch line={<Dot s={vHex} />} label={`output ${v.verdict.toLowerCase()}`} />
        <Swatch label="agents:" />
        <Swatch line={<Dot s={AGENT_STATUS_HEX.active} />} label="active" />
        <Swatch line={<Dot s={AGENT_STATUS_HEX.stale} />} label="stale" />
        <Swatch line={<Dot s={AGENT_STATUS_HEX.held} />} label="held" />
        <Swatch line={<Dot s={AGENT_STATUS_HEX.offline} />} label="offline" />
      </div>
    </Card>
  );
}

function Swatch({ line, label }: { line?: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {line && (
        <svg width={16} height={6} className="shrink-0">
          {line}
        </svg>
      )}
      <span>{label}</span>
    </span>
  );
}

const Dot = ({ s }: { s: string }) => (
  <>
    <circle cx={2} cy={3} r={1.6} fill={s} />
    <circle cx={8} cy={3} r={1.6} fill={s} />
    <circle cx={14} cy={3} r={1.6} fill={s} />
  </>
);

const Dash = ({ s }: { s: string }) => (
  <path d="M0 3 H16" stroke={s} strokeWidth={1.5} strokeDasharray="3 3" />
);
