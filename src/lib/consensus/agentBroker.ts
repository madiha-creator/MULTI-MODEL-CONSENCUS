/**
 * agentBroker — orchestrates the downstream multi-agent consensus (the
 * fusion of roadmap Phase 1 "adapters" + Phase 2 "consensus engine" into
 * the hybrid architecture): fan the trusted-state snapshot out to every
 * agent role in parallel via Promise.allSettled (constitution: one failed
 * provider call must never crash the batch — it becomes a visible ABSTAIN
 * with an error code), then arbitrate a meta-consensus over the decisions.
 *
 * The roster deliberately matches the wire-bus ids the mock broker publishes
 * (agent-a/b/c), so the StateMesh can join WS status with REST decisions.
 */
import { groqAdapter } from '@/lib/ai/groq';import type { AgentDecision, AgentMetaConsensus, ConsensusSnapshot } from '@/types/telemetry';
import type { AgentRole, ProviderAdapter } from '@/lib/ai/types';

export const AGENT_ROLES: AgentRole[] = [
  {
    agentId: 'agent-a',
    roleName: 'Navigator',
    brief:
      'You plan motion paths for the robot. You want a trusted position estimate you can steer by; ' +
      'you tolerate mild disagreement while routing around obstacles, but a collapsing consensus means ' +
      'you cannot trust where you are.',
  },
  {
    agentId: 'agent-b',
    roleName: 'Planner',
    brief:
      'You sequence the robot’s next tasks and commit them to the actuator queue. You are ' +
      'opportunistic about nominal conditions but will not schedule precision work on degraded input.',
  },
  {
    agentId: 'agent-c',
    roleName: 'Safety Monitor',
    brief:
      'You guard against physical harm. You are the most conservative consumer of trusted state: any ' +
      'unresolved outlier, excluded sensor, or gate pressure is yours to name. When unsure, CAUTION.',
  },
];

export interface RoundResult {
  configured: boolean;
  decisions: AgentDecision[];
  meta: Awaited<ReturnType<ProviderAdapter['arbitrate']>>;
}

/**
 * Run one full reasoning round. Never throws: individual failures are
 * carried per-decision (AgentDecision.error), and the caller decides how
 * to present a round whose agents all failed.
 */
export async function runAgentRound(
  snapshot: ConsensusSnapshot,
  adapter: ProviderAdapter = groqAdapter
): Promise<RoundResult> {
  const settled = await Promise.allSettled(
    AGENT_ROLES.map((role) => adapter.decide(role, snapshot))
  );

  const decisions: AgentDecision[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          // Defensive: the adapters catch internally, but an unexpected
          // throw still must not lose the agent slot.
          agentId: AGENT_ROLES[i].agentId,
          roleName: AGENT_ROLES[i].roleName,
          decision: 'ABSTAIN',
          rationale: 'Broker caught an unexpected adapter failure',
          confidence: 0,
          latencyMs: 0,
          error: 'unknown',
          busStatus: snapshot.agents.find((a) => a.agentId === AGENT_ROLES[i].agentId)?.status ?? null,
        }
  );

  const meta = await adapter.arbitrate(decisions, snapshot);
  return {
    configured: !decisions.some((d) => d.error === 'not_configured'),
    decisions,
    meta,
  };
}
