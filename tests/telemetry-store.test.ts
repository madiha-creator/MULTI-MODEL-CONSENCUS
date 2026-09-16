/**
 * Transport-state semantics of the telemetry store (audit close-out F1/F2).
 * Zustand needs no DOM, so the reconnect bookkeeping — the exact rows the
 * demo narrates ("Reconnects reads exactly 1") — can be pinned as a pure
 * state machine: boot hop must NOT count, only completed recoveries do; the
 * per-connection overlay echo must be dropped the moment the socket stops
 * being connected; and the every-tick broadcasts must not churn identity
 * when their content is unchanged.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTelemetryStore } from '@/lib/store/telemetryStore';
import type { OverlayState, WSMessage } from '@/types/telemetry';

const s = () => useTelemetryStore.getState();

function overlayMsg(over: Partial<OverlayState>): WSMessage {
  return {
    type: 'overlay_state',
    payload: {
      entries: [],
      offlineSensors: [],
      mode: 'auto',
      revision: 0,
      timestamp: 1,
      ...over,
    },
  };
}

beforeEach(() => {
  s().reset();
});

describe('connection state machine (F1)', () => {
  it('boot sequence disconnected→connecting→connected counts ZERO reconnects', () => {
    s().setConnectionState('connecting');
    s().setConnectionState('connected');
    expect(s().reconnectCount).toBe(0);
    expect(s().connectionState).toBe('connected');
  });
  it('a full outage→recovery cycle counts exactly ONE, through any attempt churn', () => {
    s().setConnectionState('connecting');
    s().setConnectionState('connected'); // boot done
    // one outage: reconnecting → connecting → (fail) → reconnecting → … → connected
    s().setConnectionState('reconnecting');
    s().setConnectionState('connecting');
    s().setConnectionState('reconnecting');
    s().setConnectionState('connecting');
    s().setConnectionState('connected');
    expect(s().reconnectCount).toBe(1);
  });
  it('terminal disconnect after attempts adds nothing (only completed hops count)', () => {
    s().setConnectionState('connecting');
    s().setConnectionState('connected');
    s().setConnectionState('reconnecting');
    s().setConnectionState('disconnected');
    expect(s().reconnectCount).toBe(0);
  });
  it('overlay echo is cleared on ANY non-connected state, and re-applies on the next overlay frame', () => {
    s().setConnectionState('connecting');
    s().setConnectionState('connected');
    s().handleMessage(overlayMsg({ mode: 'manual', revision: 4, entries: [{ sensorId: 'lidar-01', offsetPct: 40 }] }));
    expect(s().overlayState?.mode).toBe('manual');
    s().setConnectionState('reconnecting'); // a fresh mock connection WILL be auto/empty
    expect(s().overlayState).toBeNull();
    s().setConnectionState('connected');
    expect(s().overlayState).toBeNull(); // stays gone until the server echo lands
  });
});

describe('1 Hz churn guard (F2)', () => {
  it('identical overlay frames (new timestamps, same content) keep the SAME object reference', () => {
    s().handleMessage(overlayMsg({ revision: 2, timestamp: 100 }));
    const first = s().overlayState;
    s().handleMessage(overlayMsg({ revision: 2, timestamp: 999 })); // every-tick broadcast
    expect(s().overlayState).toBe(first);
  });
  it('a revision bump DOES replace', () => {
    s().handleMessage(overlayMsg({ revision: 2 }));
    const first = s().overlayState;
    s().handleMessage(overlayMsg({ revision: 3 }));
    expect(s().overlayState).not.toBe(first);
    expect(s().overlayState?.revision).toBe(3);
  });
  it('consumers frames with unchanged value content keep identity; status change replaces', () => {
    const agents = [
      { agentId: 'agent-a', agentName: 'Navigator', status: 'active' as const, consumedValue: 12, lastSync: 1 },
      { agentId: 'agent-b', agentName: 'Planner', status: 'active' as const, consumedValue: 12, lastSync: 1 },
    ];
    s().handleMessage({ type: 'consumers', payload: agents });
    const first = s().agents;
    s().handleMessage({ type: 'consumers', payload: agents.map((a) => ({ ...a, lastSync: 500 })) });
    expect(s().agents).toBe(first); // lastSync is clock noise
    s().handleMessage({ type: 'consumers', payload: [{ ...agents[0], status: 'stale' }, agents[1]] });
    expect(s().agents).not.toBe(first);
    expect(s().agents[0].status).toBe('stale');
  });
});
