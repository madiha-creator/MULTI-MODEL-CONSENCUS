'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useDriftState, useOverlayState, useConnectionState, useSensors } from '@/hooks/useTelemetry';
import { sendControl } from '@/lib/ws/sender';

/**
 * Operator controls (Prompt 7) — the sliders are real now.
 *
 * State separation, deliberately split four ways:
 *  - USER CONTROL STATE: local draft below (selected sensor + pending %).
 *    Lives only in this component; it is what you *ask* for.
 *  - BACKEND TELEMETRY STATE: `overlayState` — the server's echo of what it
 *    actually applied, and `driftState` — measured deviation. That is what
 *    *is*. The two are rendered apart ("request" vs "applied") so this panel
 *    can never fool the demo.
 *  - CONSENSUS STATE: recalculated by the simulator from the overlaid sensor
 *    values; this component never touches it.
 *  - UI STATE: the send-failure hint below.
 */
export function DriftControls() {
  const sensors = useSensors();
  const overlay = useOverlayState();
  const drift = useDriftState();
  const connectionState = useConnectionState();

  const [selectedId, setSelectedId] = useState('');
  const [offsetPct, setOffsetPct] = useState(0);
  const [sendFailed, setSendFailed] = useState(false);

  const connected = connectionState === 'connected';
  const activeId = sensors.some((s) => s.sensorId === selectedId) ? selectedId : '';
  const activeSensor = sensors.find((s) => s.sensorId === activeId);
  const appliedIds = new Set((overlay?.entries ?? []).map((e) => e.sensorId));
  const offlineIds = new Set(overlay?.offlineSensors ?? []);
  const isManual = overlay?.mode === 'manual';
  const isApplied = activeId !== '' && appliedIds.has(activeId);

  const submit = (action: Parameters<typeof sendControl>[0]) => {
    setSendFailed(!sendControl(action));
  };

  return (
    <Card
      title="Drift & Fault Injection"
      badge={
        overlay ? (
          <Badge variant={isManual ? 'warning' : 'success'}>
            {isManual ? 'MANUAL OVERLAY' : 'AUTO CYCLE'}
          </Badge>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Sensor selection — real ids straight off the wire */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" htmlFor="drift-sensor">
            Target sensor
          </label>
          <select
            id="drift-sensor"
            value={activeId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setSendFailed(false);
            }}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)]
                       px-2 py-1 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          >
            <option value="">Select sensor…</option>
            {sensors.map((s) => (
              <option key={s.sensorId} value={s.sensorId}>
                {s.sensorName} ({s.sensorId}){appliedIds.has(s.sensorId) ? ' •drifted' : ''}{offlineIds.has(s.sensorId) ? ' •offline' : ''}
              </option>
            ))}
          </select>
          {activeSensor && (
            <p className="font-mono text-[10px] tabular-nums text-[var(--color-text-muted)]">
              live {activeSensor.value} {activeSensor.unit} · status {activeSensor.status}
            </p>
          )}
        </div>

        {/* Drift value — percent of baseline, applied server-side */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Drift offset
            </span>
            <span className="font-mono text-xs tabular-nums text-[var(--color-text)]">
              {offsetPct > 0 ? '+' : ''}{offsetPct}%
            </span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={offsetPct}
            disabled={!activeId}
            onChange={(e) => setOffsetPct(parseInt(e.target.value, 10))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)]
                       [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-[var(--color-accent)] disabled:opacity-40"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={!connected || !activeId}
              onClick={() => submit({ action: 'set_drift', sensorId: activeId, offsetPct })}
              className="flex-1 rounded-md bg-[var(--color-accent)]/15 px-2 py-1 text-[11px] font-semibold
                         uppercase tracking-wider text-[var(--color-accent)] transition-colors
                         hover:bg-[var(--color-accent)]/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply drift
            </button>
            <button
              type="button"
              disabled={!connected || !isApplied}
              onClick={() => submit({ action: 'clear_drift', sensorId: activeId })}
              className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] font-medium
                         text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]
                         disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          {activeId && !isApplied && offsetPct !== 0 && (
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Requested: {activeId} {offsetPct > 0 ? '+' : ''}{offsetPct}% — not yet applied
            </p>
          )}
        </div>

        {/* Offline toggle + global actions */}
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!connected || !activeId}
            onClick={() => submit({ action: 'set_offline', sensorId: activeId, offline: !offlineIds.has(activeId) })}
            className="flex-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] font-medium
                       text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {activeId && offlineIds.has(activeId) ? 'Bring online' : 'Simulate offline'}
          </button>
          <button
            type="button"
            disabled={!connected}
            onClick={() => submit({ action: 'reset_all' })}
            className="rounded-md border border-[var(--color-risk-low)]/40 px-2 py-1 text-[11px] font-semibold
                       uppercase tracking-wider text-[var(--color-risk-low)] transition-colors
                       hover:bg-[var(--color-risk-low)]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset all
          </button>
        </div>

        {/* Boundary demo (Prompt 9, S6): one bad frame — the client must drop it safely */}
        <button
          type="button"
          disabled={!connected}
          onClick={() => submit({ action: 'inject_malformed' })}
          className="w-full rounded-md border border-dashed border-[var(--color-border)] px-2 py-1
                     text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]
                     transition-colors hover:bg-[var(--color-bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Diagnostic: inject malformed frame
        </button>

        {!connected && (
          <p className="text-[10px] text-[var(--color-risk-medium)]">Controls disabled — telemetry link down.</p>
        )}
        {sendFailed && connected && (
          <p className="text-[10px] text-[var(--color-risk-high)]">Control not sent — retry or check the server.</p>
        )}

        {/* Applied state, echoed by the server — NOT mirrored from the sliders */}
        <div className="border-t border-[var(--color-border)] pt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Measured drift
            </span>
            <span
              className={`font-mono text-xs tabular-nums ${
                (drift?.magnitude ?? 0) > 0.5
                  ? 'text-[var(--color-risk-high)]'
                  : (drift?.magnitude ?? 0) > 0.2
                    ? 'text-[var(--color-risk-medium)]'
                    : 'text-[var(--color-risk-low)]'
              }`}
            >
              {drift ? `${(drift.magnitude * 100).toFixed(1)}% ${drift.direction}` : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Applied overlays
            </span>
            {overlay && overlay.entries.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-1">
                {overlay.entries.map((e) => (
                  <Badge key={e.sensorId} variant="warning" className="text-[9px]">
                    {e.sensorId} {e.offsetPct > 0 ? '+' : ''}{e.offsetPct}%
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-[var(--color-text-muted)]">none</span>
            )}
          </div>
          {overlay && overlay.offlineSensors.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                Offline
              </span>
              <div className="flex flex-wrap justify-end gap-1">
                {overlay.offlineSensors.map((id) => (
                  <Badge key={id} variant="error" className="text-[9px]">
                    {id}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {overlay && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                Scenario rev
              </span>
              <span className="font-mono text-[10px] tabular-nums text-[var(--color-text-muted)]">
                #{overlay.revision}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
