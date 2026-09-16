/**
 * Groq adapter — the single ProviderAdapter implementation for the agent
 * bus. Three roles (Navigator/Planner/Safety Monitor) + one arbiter call
 * per round to openai/gpt-oss-20b on Groq, with json_schema structured
 * output (strict) so decisions are schema-validated, not hoped for.
 *
 * Why Groq for a hackathon: sub-second completion time (measured ~0.4s of
 * generation per decision), a free-tier key, and gpt-oss's reasoning-token
 * budget keeps the agents actually deliberating. The adapter boundary
 * (lib/ai/types.ts) is what the constitution's adapter pattern protects —
 * swapping vendors later is one more file like this one, nothing above it.
 */
import Groq from 'groq-sdk';
import { z } from 'zod';
import { toProviderError } from '@/lib/ai/errors';
import type {
  AgentDecision,
  AgentMetaConsensus,
  ConsensusSnapshot,
  DecisionWord,
} from '@/types/telemetry';
import type { AgentRole, ProviderAdapter } from '@/lib/ai/types';

export const GROQ_MODEL = 'openai/gpt-oss-20b';

/** Hard ceiling so one slow call can never overrun the UI's round cadence. */
const CALL_TIMEOUT_MS = 15_000;

const DecisionSchema = z.object({
  decision: z.enum(['PROCEED', 'CAUTION', 'ABSTAIN']),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});

const ArbiterSchema = z.object({
  recommendation: z.enum(['PROCEED', 'CAUTION', 'ABSTAIN']),
  summary: z.string(),
});

function schemaFormat(name: string, schema: z.ZodObject) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name,
      strict: true,
      schema: z.toJSONSchema(schema, { target: 'draft-2020-12' }),
    },
  };
}

function isConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/** Lazily-built singleton; only constructed when a key exists. */
let client: Groq | null = null;
function getClient(): Groq {
  if (!client) client = new Groq();
  return client;
}

/** Render the snapshot the way an agent should see it — compact, factual. */
function renderSnapshot(snapshot: ConsensusSnapshot): string {
  const sensors = snapshot.sensors
    .map((s) => `${s.name} (${s.id}): ${s.status}`)
    .join('\n- ');
  const agents = snapshot.agents
    .map((a) => `${a.agentId}: bus=${a.status}, consuming=${a.consumedValue ?? 'none'}`)
    .join('\n- ');
  return [
    `Broker verdict: ${snapshot.verdict}`,
    `Trusted value: ${snapshot.trustedValue === null ? 'UNKNOWN (broker refuses to publish)' : snapshot.trustedValue.toFixed(3) + ' (unitless demo scale)'}`,
    `Agreement: ${snapshot.agreementPct}% — ${snapshot.contributingCount} contributing, ${snapshot.excludedCount} excluded`,
    `Action gate: ${snapshot.gateState ?? 'unknown'}`,
    `Sensors:\n- ${sensors}`,
    `Agent bus consumers:\n- ${agents}`,
  ].join('\n');
}

function systemFor(role: AgentRole): string {
  return (
    `You are ${role.roleName}, one of several autonomous agents subscribed to a consensus broker's ` +
    `trusted state for a physical robot. ${role.brief}\n\n` +
    `You will be shown the CURRENT state: the broker's verdict, the trusted value, sensor health, ` +
    `the action gate, and your own bus status. Decide whether YOU act on this trusted state:\n` +
    `- PROCEED: the trusted state is sound enough to act on.\n` +
    `- CAUTION: act only defensively — you see residual risk worth naming.\n` +
    `- ABSTAIN: refuse to decide (e.g. broker published UNKNOWN, or your own feed is stale/held).\n\n` +
    `Rules: be honest — if the broker itself refuses (verdict FAILED / trusted value UNKNOWN), ABSTAIN. ` +
    `If your own bus status is stale/held/offline, factor that in. Reason from the sensor-health lines, ` +
    `not vibes. Rationale: one sentence, under 220 characters, naming the concrete evidence. ` +
    `confidence is your calibrated 0–1 certainty in this decision.`
  );
}

async function completeJson<T>(
  system: string,
  user: string,
  formatName: string,
  schema: z.ZodObject,
  parse: (raw: unknown) => T | null
): Promise<T | null> {
  const completion = await getClient().chat.completions.create(
    {
      model: GROQ_MODEL,
      max_completion_tokens: 1024,
      response_format: schemaFormat(formatName, schema),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    { timeout: CALL_TIMEOUT_MS }
  );
  const content = completion.choices[0]?.message?.content;
  if (!content) return null;
  try {
    return parse(JSON.parse(content));
  } catch {
    return null;
  }
}

export const groqAdapter: ProviderAdapter = {
  async decide(role: AgentRole, snapshot: ConsensusSnapshot): Promise<AgentDecision> {
    const base = {
      agentId: role.agentId,
      roleName: role.roleName,
      busStatus: snapshot.agents.find((a) => a.agentId === role.agentId)?.status ?? null,
    };
    if (!isConfigured()) {
      return {
        ...base,
        decision: 'ABSTAIN',
        rationale: 'Reasoning layer not configured (no GROQ_API_KEY)',
        confidence: 0,
        latencyMs: 0,
        error: 'not_configured',
      };
    }
    const started = Date.now();
    try {
      const parsed = await completeJson(
        systemFor(role),
        renderSnapshot(snapshot),
        'agent_decision',
        DecisionSchema,
        (raw) => DecisionSchema.safeParse(raw).data ?? null
      );
      if (!parsed) {
        return {
          ...base,
          decision: 'ABSTAIN',
          rationale: 'Model output failed schema validation',
          confidence: 0,
          latencyMs: Date.now() - started,
          error: 'parse_failed',
        };
      }
      return {
        ...base,
        decision: parsed.decision,
        rationale: parsed.rationale.slice(0, 220),
        confidence: parsed.confidence,
        latencyMs: Date.now() - started,
        error: null,
      };
    } catch (error) {
      const mapped = toProviderError(error);
      return {
        ...base,
        decision: 'ABSTAIN',
        rationale: mapped.message,
        confidence: 0,
        latencyMs: Date.now() - started,
        error: mapped.code,
      };
    }
  },

  async arbitrate(
    decisions: AgentDecision[],
    snapshot: ConsensusSnapshot
  ): Promise<AgentMetaConsensus> {
    // Counts are computed from real decisions — the arbiter never invents them.
    const real = decisions.filter((d) => d.error === null);
    const counts = (w: DecisionWord) => real.filter((d) => d.decision === w).length;
    const tally: Record<DecisionWord, number> = {
      PROCEED: counts('PROCEED'),
      CAUTION: counts('CAUTION'),
      ABSTAIN: counts('ABSTAIN'),
    };
    const majorityWord = (Object.keys(tally) as DecisionWord[]).reduce((a, b) =>
      tally[b] > tally[a] ? b : a
    );
    const majority = tally[majorityWord];
    const failed = decisions.length - real.length;
    // Dissent = every real decision outside the majority bucket (ABSTAINs
    // only count as dissent when ABSTAIN is not itself the majority).
    const dissent =
      real.length - majority - (majorityWord === 'ABSTAIN' ? 0 : tally.ABSTAIN);

    const ruleFallback: AgentMetaConsensus = {
      recommendation: majorityWord,
      concurrence: majority,
      dissent,
      summary:
        real.length === 0
          ? `All ${failed} agents failed to reason — no agent consensus.`
          : `${majority}/${real.length} agents ${majorityWord.toLowerCase()} (rule-based tally).`,
      arbitrated: false,
      latencyMs: null,
    };
    if (!isConfigured() || real.length === 0) return ruleFallback;

    const started = Date.now();
    try {
      const listing = decisions
        .map(
          (d) =>
            `- ${d.roleName} [${d.agentId}]: ${d.error ? `FAILED (${d.error})` : d.decision}, ` +
            `confidence ${d.confidence.toFixed(2)} — "${d.rationale}"`
        )
        .join('\n');
      const parsed = await completeJson(
        `You are the arbitration layer of a multi-agent consensus broker. Several agents have ` +
          `individually decided whether to act on the broker's trusted state. Weigh their rationales ` +
          `(a well-evidenced dissent can outweigh a shallow majority) and issue the bus-level ` +
          `recommendation plus a one-sentence summary (under 240 chars) naming which agents dissented ` +
          `and why. If agents failed to answer, count them as no-decision, not agreement.`,
        `Trusted-state snapshot:\n${renderSnapshot(snapshot)}\n\nAgent decisions:\n${listing}`,
        'arbiter_consensus',
        ArbiterSchema,
        (raw) => ArbiterSchema.safeParse(raw).data ?? null
      );
      if (!parsed) return ruleFallback;
      return {
        recommendation: parsed.recommendation,
        concurrence: majority,
        dissent,
        summary: parsed.summary.slice(0, 240),
        arbitrated: true,
        latencyMs: Date.now() - started,
      };
    } catch {
      return ruleFallback;
    }
  },
};
