/**
 * AI-provider types for the agent reasoning layer — the downstream half of
 * the hybrid architecture: the sensor broker publishes a trusted state, and
 * LLM agents reason over it. Shared decision/round/snapshot shapes live in
 * src/types/telemetry.ts (so components never import lib/ — constitution
 * file-boundary rule); this file holds only provider-integration concepts.
 */
import type {
  AgentDecision,
  AgentMetaConsensus,
  ConsensusSnapshot,
} from '@/types/telemetry';

export interface AgentRole {
  /** Must match the wire-bus ids the broker publishes (types AgentState). */
  agentId: string;
  roleName: string;
  /** Persona/system prompt for this agent's reasoning role. */
  brief: string;
}

/**
 * Adapter boundary (constitution: every provider call goes through one).
 * Currently implemented only by the Anthropic adapter; a second vendor is
 * one more implementation + a roster entry, nothing above this line changes.
 */
export interface ProviderAdapter {
  decide(role: AgentRole, snapshot: ConsensusSnapshot): Promise<AgentDecision>;
  arbitrate(
    decisions: AgentDecision[],
    snapshot: ConsensusSnapshot
  ): Promise<AgentMetaConsensus>;
}
