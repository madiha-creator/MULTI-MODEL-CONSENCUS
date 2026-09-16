import { create } from 'zustand';
import type {
  ConnectionState,
  SensorReading,
  SensorDisagreement,
  ConsensusState,
  RiskAssessment,
  ActionGate,
  Outlier,
  TelemetryEvent,
  AgentState,
  AgentRound,
  DriftState,
  OverlayState,
  ActuatorState,
  ConnectionMetrics,
  WSMessage,
} from '@/types/telemetry';
import { setInvalidFrameHandler } from '@/lib/ws/validate';

const MAX_EVENTS = 100;

interface TelemetryState {
  connectionState: ConnectionState;
  lastHeartbeat: number | null;
  sensors: SensorReading[];
  disagreements: SensorDisagreement[];
  consensus: ConsensusState | null;
  risk: RiskAssessment | null;
  actionGate: ActionGate | null;
  outliers: Outlier[];
  events: TelemetryEvent[];
  agents: AgentState[];
  driftState: DriftState | null;
  /** Server-authoritative echo of the operator overlay (wire state, not user state). */
  overlayState: OverlayState | null;
  actuatorState: ActuatorState | null;
  connectionMetrics: ConnectionMetrics;
  /**
   * Transport/UI state owned by the CLIENT, not the wire. The server's
   * connection_metrics.reconnectCount is hardcoded 0 — the store overrides
   * it with this real counter on every merge.
   */
  reconnectCount: number;
  /** True after the first successful 'connected' of this session — makes reconnectCount ignore the boot hop. */
  hasConnected: boolean;
  /** Inbound frames dropped by Zod/JSON validation — makes "malformed telemetry handled safely" visible. */
  invalidFrameCount: number;
  /** Latest LLM reasoning round from /api/agents/decide (REST, not WS). */
  agentRound: AgentRound | null;
  handleMessage: (msg: WSMessage) => void;
  markInvalidFrame: () => void;
  setConnectionState: (state: ConnectionState) => void;
  setAgentRound: (round: AgentRound | null) => void;
  reset: () => void;
}

const defaultConnectionMetrics: ConnectionMetrics = {
  latencyMs: null,
  reconnectCount: 0,
  uptimeMs: 0,
  lastMessageTime: null,
  messagesReceived: 0,
};

const initialState = {
  connectionState: 'disconnected' as ConnectionState,
  lastHeartbeat: null,
  sensors: [] as SensorReading[],
  disagreements: [] as SensorDisagreement[],
  consensus: null as ConsensusState | null,
  risk: null as RiskAssessment | null,
  actionGate: null as ActionGate | null,
  outliers: [] as Outlier[],
  events: [] as TelemetryEvent[],
  agents: [] as AgentState[],
  driftState: null as DriftState | null,
  overlayState: null as OverlayState | null,
  actuatorState: null as ActuatorState | null,
  connectionMetrics: defaultConnectionMetrics,
  reconnectCount: 0,
  hasConnected: false,
  invalidFrameCount: 0,
  agentRound: null as AgentRound | null,
};

/**
 * The mock broadcasts overlay_state + consumers EVERY tick, so without these
 * identity guards both slices get a fresh object/array reference per second
 * and their consumers (DriftControls, StateMesh) re-render at 1 Hz for zero
 * content change — the same churn the connectionMetrics fix retired. Keep the
 * previous reference while content-equal; a real change still repaints ≤1 tick.
 * Clock fields (timestamps, lastSync) are deliberately excluded: they change
 * every tick and pinning them would pin nothing.
 */
function sameOverlay(a: OverlayState | null, b: OverlayState): boolean {
  if (!a || a.revision !== b.revision || a.mode !== b.mode) return false;
  if (a.entries.length !== b.entries.length) return false;
  if (a.offlineSensors.length !== b.offlineSensors.length) return false;
  return a.entries.every((e, i) => {
    const f = b.entries[i];
    return e.sensorId === f.sensorId && e.offsetPct === f.offsetPct;
  });
}
function sameAgents(a: AgentState[], b: AgentState[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return x.agentId === y.agentId && x.status === y.status && x.consumedValue === y.consumedValue;
  });
}

// PERSISTENCE SEAM (future MongoDB/history work): a zustand/middleware persist
// on this store — or a subscriber in useWebSocket — is where snapshots get
// written. Kept deliberately unattached until the persistence module lands.
export const useTelemetryStore = create<TelemetryState>((set) => ({
  ...initialState,

  setConnectionState: (connectionState) =>
    set((state) => {
      // The server overlay lives per-connection, so ANY socket that isn't up
      // (or is on its way back up) has an echo that is guaranteed false — a
      // fresh connection starts AUTO/empty. Clear on every non-connected
      // state, not just the terminal one; the tick broadcast re-applies it
      // once transport is back.
      const patch: Partial<TelemetryState> =
        connectionState !== 'connected' ? { overlayState: null } : {};
      // reconnectCount is client-owned and counts COMPLETED recovery hops,
      // not attempts: the store's own backoff cycle is
      // reconnecting→connecting→connected per attempt, so incrementing on
      // 'reconnecting' would inflate one outage to ~10. Only an entry into
      // 'connected' that FOLLOWS a prior successful connection counts —
      // `hasConnected` makes the boot hop disconnected→connecting→connected
      // correctly read 0.
      if (connectionState === 'connected') {
        const recovered =
          state.hasConnected &&
          (state.connectionState === 'connecting' || state.connectionState === 'reconnecting');
        return {
          ...patch,
          connectionState,
          hasConnected: true,
          reconnectCount: state.reconnectCount + (recovered ? 1 : 0),
        };
      }
      return { ...patch, connectionState };
    }),

  setAgentRound: (agentRound) => set({ agentRound }),

  markInvalidFrame: () => set((state) => ({ invalidFrameCount: state.invalidFrameCount + 1 })),

  handleMessage: (msg) =>
    set((state) => {
      switch (msg.type) {
        case 'telemetry':
          return { sensors: msg.payload };

        case 'disagreement':
          return { disagreements: msg.payload };

        case 'consensus':
          return { consensus: msg.payload };

        case 'risk':
          return { risk: msg.payload };

        case 'action_gate':
          return { actionGate: msg.payload };

        case 'outliers':
          return { outliers: msg.payload };

        case 'event': {
          const events = [msg.payload, ...state.events].slice(0, MAX_EVENTS);
          return { events };
        }

        case 'heartbeat':
          return {
            lastHeartbeat: msg.payload.timestamp,
          };

        case 'drift_state':
          return { driftState: msg.payload };

        case 'actuator_state':
          return { actuatorState: msg.payload };

        case 'connection_metrics':
          // Wire payload is truth for server-side fields (latency, uptime,
          // server message count), but reconnectCount is client-owned — the
          // server hardcodes 0 and can't see our retries. This is the ONLY
          // case touching connectionMetrics, so its consumers re-render on
          // the 5-second server stats, not on every one of the ~11 frames/tick.
          return {
            connectionMetrics: {
              ...msg.payload,
              reconnectCount: state.reconnectCount,
            },
          };

        case 'consumers':
          return sameAgents(state.agents, msg.payload) ? {} : { agents: msg.payload };

        case 'overlay_state':
          return sameOverlay(state.overlayState, msg.payload) ? {} : { overlayState: msg.payload };

        default: {
          const _exhaustive: never = msg;
          console.warn('[Telemetry] Unknown message type:', _exhaustive);
          return {};
        }
      }
    }),

  reset: () => set(initialState),
}));

// Wire the validator's rejection path into the visible counter. Import-cycle
// safe: validate.ts imports no store code.
setInvalidFrameHandler(() => useTelemetryStore.getState().markInvalidFrame());
