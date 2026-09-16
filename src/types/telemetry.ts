export type SensorStatus = 'normal' | 'warning' | 'critical' | 'offline';
export type SensorType = 'imu' | 'lidar' | 'thermal' | 'gyro' | 'accelerometer' | 'compass';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type GateState = 'ALLOW' | 'BLOCK' | 'HOLD';
export type EventSeverity = 'info' | 'warning' | 'critical';
export type EventType = 'reading' | 'disagreement' | 'consensus' | 'risk' | 'action' | 'system';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface SensorReading {
  sensorId: string;
  sensorName: string;
  sensorType: SensorType;
  value: number;
  unit: string;
  confidence: number;
  timestamp: number;
  status: SensorStatus;
}

export interface SensorDisagreement {
  sensorPair: [string, string];
  variance: number;
  threshold: number;
  isDisagreeing: boolean;
  timestamp: number;
}

export interface ConsensusState {
  trustedValue: number;
  confidence: number;
  agreementRatio: number;
  contributingSensors: string[];
  excludedSensors: string[];
  timestamp: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: string[];
  affectedSensors: string[];
  timestamp: number;
}

export interface ActionGate {
  state: GateState;
  reason: string;
  triggeredBy: string;
  timestamp: number;
}

export interface Outlier {
  sensorId: string;
  sensorName: string;
  deviation: number;
  reason: string;
  flaggedAt: number;
}

export interface TelemetryEvent {
  id: string;
  type: EventType;
  message: string;
  severity: EventSeverity;
  timestamp: number;
  source?: string;
}

export interface DriftState {
  magnitude: number;
  direction: 'positive' | 'negative' | 'none';
  affectedSensors: string[];
  lastCorrection: number;
  timestamp: number;
}

export interface ActuatorState {
  motorEnabled: boolean;
  motorRpm: number;
  servoAngle: number;
  emergencyStop: boolean;
  lastCommand: string;
  timestamp: number;
}

export interface ConnectionMetrics {
  latencyMs: number | null;
  reconnectCount: number;
  uptimeMs: number;
  lastMessageTime: number | null;
  messagesReceived: number;
}

export type AgentStatus = 'active' | 'stale' | 'held' | 'offline';

/**
 * A downstream AI agent consuming the broker's trusted state.
 *  status: 'active'  = receiving fresh trusted state each tick
 *          'stale'   = subscribed, but last sync aged out (broker degraded)
 *          'held'    = broker deliberately withholding updates (no consensus)
 *          'offline' = not connected to the trusted-state bus
 *  consumedValue: the value the agent currently acts on; null ⇔ held/offline —
 *          a stale consumer must never silently act on an old number.
 */
export interface AgentState {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  consumedValue: number | null;
  lastSync: number;
}

// ── LLM reasoning layer (Phase 1 hybrid) ─────────────────────────────────────
// Domain types for the agent-decision round-trip with /api/agents/decide.
// They live here (global types) so components can consume them without
// importing lib/ai — the constitution's file-boundary rule.

/** What a single agent decides about acting on the current trusted state. */
export type DecisionWord = 'PROCEED' | 'CAUTION' | 'ABSTAIN';

export interface AgentDecision {
  agentId: string;
  roleName: string;
  decision: DecisionWord;
  rationale: string;
  confidence: number;
  latencyMs: number;
  /** Non-null ⇔ provider failure, not a model choice. */
  error: string | null;
  /** Wire-bus status this agent held when it decided (attribution). */
  busStatus: AgentStatus | null;
}

export interface AgentMetaConsensus {
  recommendation: DecisionWord;
  /** How many agents the arbiter grouped with the majority. */
  concurrence: number;
  dissent: number;
  /** Arbiter's one-sentence synthesis (or rule-based fallback). */
  summary: string;
  /** True ⇔ summary came from the model; false ⇔ counting fallback. */
  arbitrated: boolean;
  latencyMs: number | null;
}

/** One full fan-out round: every agent decided, meta-consensus produced. */
export interface AgentRound {
  roundId: number;
  finishedAt: number;
  /** The broker verdict the round ran under (attribution for the UI). */
  snapshotVerdict: 'NO_DATA' | 'AGREEMENT' | 'DEGRADED' | 'FAILED';
  decisions: AgentDecision[];
  meta: AgentMetaConsensus | null;
  /** false ⇔ server has no API key — reasoning layer unavailable. */
  configured: boolean;
}

/** Everything the agents are shown to decide on (client → API route). */
export interface ConsensusSnapshot {
  trustedValue: number | null;
  verdict: 'NO_DATA' | 'AGREEMENT' | 'DEGRADED' | 'FAILED';
  agreementPct: number;
  contributingCount: number;
  excludedCount: number;
  sensors: { id: string; name: string; status: SensorStatus }[];
  gateState: GateState | null;
  agents: { agentId: string; status: AgentStatus; consumedValue: number | null }[];
}

// ── Operator controls (Prompt 7) ─────────────────────────────────────────────
// Outbound client → server frames. The inbound WSMessage contract excludes
// them — the server validates control frames with a mirrored Zod schema (the
// client's heartbeat pings are the only other outbound frame, handled ad-hoc
// server-side). One discriminated `action` union keeps the control channel
// additive forever.

export type ControlAction =
  /** Set a sensor's drift offset (percent of its base value). |offsetPct| > 50 is REJECTED, not clamped. */
  | { action: 'set_drift'; sensorId: string; offsetPct: number }
  /** Remove a sensor's drift offset. */
  | { action: 'clear_drift'; sensorId: string }
  /** Toggle a sensor's offline status in the simulator. */
  | { action: 'set_offline'; sensorId: string; offline: boolean }
  /** Ask the server to send back exactly one schema-invalid telemetry frame (boundary demo). */
  | { action: 'inject_malformed' }
  /** Clear overlay + offline set; simulator resumes the scripted scenario cycle. */
  | { action: 'reset_all' };

export interface ControlMessage {
  type: 'control';
  payload: ControlAction;
}

/** Server-authoritative echo of the operator overlay, broadcast every tick. */
export interface OverlaySensor {
  sensorId: string;
  offsetPct: number;
}

export interface OverlayState {
  /** Active drift overrides — server truth, not the client's request. */
  entries: OverlaySensor[];
  offlineSensors: string[];
  /** 'manual' ⇔ any overlay/offline entry active: scripted scenario victims suppressed. */
  mode: 'auto' | 'manual';
  /** Per-connection mutation counter; UI can drop stale echoes. */
  revision: number;
  timestamp: number;
}

export type WSMessage =
  | { type: 'telemetry'; payload: SensorReading[] }
  | { type: 'disagreement'; payload: SensorDisagreement[] }
  | { type: 'consensus'; payload: ConsensusState }
  | { type: 'risk'; payload: RiskAssessment }
  | { type: 'action_gate'; payload: ActionGate }
  | { type: 'outliers'; payload: Outlier[] }
  | { type: 'event'; payload: TelemetryEvent }
  | { type: 'heartbeat'; payload: { timestamp: number } }
  | { type: 'drift_state'; payload: DriftState }
  | { type: 'actuator_state'; payload: ActuatorState }
  | { type: 'connection_metrics'; payload: ConnectionMetrics }
  | { type: 'consumers'; payload: AgentState[] }
  | { type: 'overlay_state'; payload: OverlayState };
