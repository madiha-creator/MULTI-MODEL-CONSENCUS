import { z } from 'zod';
import type { ControlMessage } from '@/types/telemetry';

const SensorReadingSchema = z.object({
  sensorId: z.string(),
  sensorName: z.string(),
  sensorType: z.enum(['imu', 'lidar', 'thermal', 'gyro', 'accelerometer', 'compass']),
  value: z.number(),
  unit: z.string(),
  confidence: z.number(),
  timestamp: z.number(),
  status: z.enum(['normal', 'warning', 'critical', 'offline']),
});

const SensorDisagreementSchema = z.object({
  sensorPair: z.tuple([z.string(), z.string()]),
  variance: z.number(),
  threshold: z.number(),
  isDisagreeing: z.boolean(),
  timestamp: z.number(),
});

const ConsensusStateSchema = z.object({
  trustedValue: z.number(),
  confidence: z.number(),
  agreementRatio: z.number(),
  contributingSensors: z.array(z.string()),
  excludedSensors: z.array(z.string()),
  timestamp: z.number(),
});

const RiskAssessmentSchema = z.object({
  level: z.enum(['low', 'medium', 'high', 'critical']),
  score: z.number(),
  factors: z.array(z.string()),
  affectedSensors: z.array(z.string()),
  timestamp: z.number(),
});

const ActionGateSchema = z.object({
  state: z.enum(['ALLOW', 'BLOCK', 'HOLD']),
  reason: z.string(),
  triggeredBy: z.string(),
  timestamp: z.number(),
});

const OutlierSchema = z.object({
  sensorId: z.string(),
  sensorName: z.string(),
  deviation: z.number(),
  reason: z.string(),
  flaggedAt: z.number(),
});

const TelemetryEventSchema = z.object({
  id: z.string(),
  type: z.enum(['reading', 'disagreement', 'consensus', 'risk', 'action', 'system']),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  timestamp: z.number(),
  source: z.string().optional(),
});

const HeartbeatSchema = z.object({
  timestamp: z.number(),
});

const DriftStateSchema = z.object({
  magnitude: z.number(),
  direction: z.enum(['positive', 'negative', 'none']),
  affectedSensors: z.array(z.string()),
  lastCorrection: z.number(),
  timestamp: z.number(),
});

const ActuatorStateSchema = z.object({
  motorEnabled: z.boolean(),
  motorRpm: z.number(),
  servoAngle: z.number(),
  emergencyStop: z.boolean(),
  lastCommand: z.string(),
  timestamp: z.number(),
});

const ConnectionMetricsSchema = z.object({
  latencyMs: z.number().nullable(),
  reconnectCount: z.number(),
  uptimeMs: z.number(),
  lastMessageTime: z.number().nullable(),
  messagesReceived: z.number(),
});

const AgentStateSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  status: z.enum(['active', 'stale', 'held', 'offline']),
  consumedValue: z.number().nullable(),
  lastSync: z.number(),
});

const OverlayStateSchema = z.object({
  entries: z.array(z.object({ sensorId: z.string(), offsetPct: z.number() })),
  offlineSensors: z.array(z.string()),
  mode: z.enum(['auto', 'manual']),
  revision: z.number(),
  timestamp: z.number(),
});

const WSMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('telemetry'), payload: z.array(SensorReadingSchema) }),
  z.object({ type: z.literal('disagreement'), payload: z.array(SensorDisagreementSchema) }),
  z.object({ type: z.literal('consensus'), payload: ConsensusStateSchema }),
  z.object({ type: z.literal('risk'), payload: RiskAssessmentSchema }),
  z.object({ type: z.literal('action_gate'), payload: ActionGateSchema }),
  z.object({ type: z.literal('outliers'), payload: z.array(OutlierSchema) }),
  z.object({ type: z.literal('event'), payload: TelemetryEventSchema }),
  z.object({ type: z.literal('heartbeat'), payload: HeartbeatSchema }),
  z.object({ type: z.literal('drift_state'), payload: DriftStateSchema }),
  z.object({ type: z.literal('actuator_state'), payload: ActuatorStateSchema }),
  z.object({ type: z.literal('connection_metrics'), payload: ConnectionMetricsSchema }),
  z.object({ type: z.literal('consumers'), payload: z.array(AgentStateSchema) }),
  z.object({ type: z.literal('overlay_state'), payload: OverlayStateSchema }),
]);

type ValidatedWSMessage = z.infer<typeof WSMessageSchema>;

// ── Inbound-frame rejection reporting (Prompt 9 observability) ──────────────
// The store registers a handler at module init; every rejected frame (bad
// JSON or schema violation) increments a visible counter instead of vanishing
// silently, so "malformed telemetry" is demonstrable and not just asserted.

type InvalidFrameReason = 'schema' | 'parse';
let onInvalidFrame: ((reason: InvalidFrameReason) => void) | null = null;

export function setInvalidFrameHandler(handler: ((reason: InvalidFrameReason) => void) | null): void {
  onInvalidFrame = handler;
}

export function notifyInvalidFrame(reason: InvalidFrameReason): void {
  onInvalidFrame?.(reason);
}

export function validateMessage(raw: unknown): ValidatedWSMessage | null {
  const result = WSMessageSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  console.warn('[WS] Rejected malformed message:', result.error.format());
  notifyInvalidFrame('schema');
  return null;
}

// ── Outbound control frames (client → server, Prompt 7) ─────────────────────
// Mirrored (kept in sync) by scripts/mock-ws-server.js's inbound guard.

export const ControlMessageSchema = z.object({
  type: z.literal('control'),
  payload: z.discriminatedUnion('action', [
    z.object({ action: z.literal('set_drift'), sensorId: z.string().min(1), offsetPct: z.number().min(-50).max(50) }),
    z.object({ action: z.literal('clear_drift'), sensorId: z.string().min(1) }),
    z.object({ action: z.literal('set_offline'), sensorId: z.string().min(1), offline: z.boolean() }),
    z.object({ action: z.literal('inject_malformed') }),
    z.object({ action: z.literal('reset_all') }),
  ]),
}) satisfies z.ZodType<ControlMessage>;

/** Send pre-flight: returns the typed frame or null (never sends an invalid control). */
export function validateControl(raw: unknown): ControlMessage | null {
  const result = ControlMessageSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  console.warn('[WS] Rejected malformed control:', result.error.format());
  return null;
}
