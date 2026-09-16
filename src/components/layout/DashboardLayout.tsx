'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useAgentBusRounds } from '@/hooks/useAgentBusRounds';
import { useConnectionStatus } from '@/hooks/useTelemetry';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { SensorGrid } from '@/components/dashboard/SensorGrid';
import { ConsensusStatusBar } from '@/components/dashboard/ConsensusStatusBar';
import { ConsensusPanel } from '@/components/dashboard/ConsensusPanel';
import { RiskGauge } from '@/components/dashboard/RiskGauge';
import { ActionGate } from '@/components/dashboard/ActionGate';
import { OutlierList } from '@/components/dashboard/OutlierList';
import { DisagreementChart } from '@/components/dashboard/DisagreementChart';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { StateMesh } from '@/components/dashboard/StateMesh';
import { AgentConsensusPanel } from '@/components/dashboard/AgentConsensusPanel';
import { DriftControls } from '@/components/dashboard/DriftControls';
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus';
import { TrustedStatePanel } from '@/components/dashboard/TrustedStatePanel';
import { PhysicalActionPanel } from '@/components/dashboard/PhysicalActionPanel';
import { AlertTriangle } from 'lucide-react';
import type { ConnectionState } from '@/types/telemetry';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

const RECONNECT_BANNER_MESSAGES: Record<Extract<ConnectionState, 'connecting' | 'reconnecting' | 'disconnected'>, string> = {
  connecting: 'CONNECTING — Establishing WebSocket connection...',
  reconnecting: 'CONNECTION LOST — Reconnecting...',
  disconnected: 'DISCONNECTED — Could not reach server. Check backend.',
};

export function DashboardLayout() {
  const { retry } = useWebSocket(WS_URL);
  useAgentBusRounds();
  const { connectionState } = useConnectionStatus();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      <TopBar />
      {(connectionState === 'connecting' || connectionState === 'reconnecting' || connectionState === 'disconnected') && (
        <ReconnectBanner state={connectionState} onRetry={retry} />
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-3">
            {/* Row 0: Live safety verdict strip (consensus / risk / action / trusted value) */}
            <ConsensusStatusBar />

            {/* Row 1: Infrastructure pipeline (sensors → broker → trusted
                state → agents) beside the live LLM decision panel — the two
                halves of the agent bus: wire status on the mesh, reasoning
                on the panel. */}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <div className="xl:col-span-3">
                <StateMesh />
              </div>
              <div className="xl:col-span-1">
                <AgentConsensusPanel />
              </div>
            </div>

            {/* Row 2: Sensor Grid — full width */}
            <SensorGrid />

            {/* Row 3: Decision panels — Consensus | Risk | Action Gate */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <ConsensusPanel />
              <RiskGauge />
              <ActionGate />
            </div>

            {/* Row 4: Controls — Drift | Physical Action | Connection */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <DriftControls />
              <PhysicalActionPanel />
              <ConnectionStatus />
            </div>

            {/* Row 5: Detail panels — Disagreements | Outliers */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <DisagreementChart />
              <OutlierList />
            </div>

            {/* Row 6: Trusted State | Activity Feed */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="lg:col-span-1">
                <TrustedStatePanel />
              </div>
              <div className="lg:col-span-3">
                <ActivityFeed />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ReconnectBanner({
  state,
  onRetry,
}: {
  state: Extract<ConnectionState, 'connecting' | 'reconnecting' | 'disconnected'>;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2">
      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
      <span className="text-xs font-medium text-red-400">
        {RECONNECT_BANNER_MESSAGES[state]}
      </span>
      {/* Terminal state: the backoff budget is spent and nothing retries on
          its own — give the operator a manual way back. */}
      {state === 'disconnected' && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-2 rounded border border-red-400/40 bg-red-400/10 px-2 py-0.5
                     text-[10px] font-semibold uppercase tracking-wider text-red-300
                     transition-colors hover:bg-red-400/20"
        >
          Retry now
        </button>
      )}
    </div>
  );
}
