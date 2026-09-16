/**
 * POST /api/agents/decide — the reasoning-layer seam.
 *
 * The dashboard sends the current consensus snapshot (the client owns the
 * live wire state; this route is stateless), and the broker fans it out to
 * the agent roster, returning per-agent decisions + the meta-consensus.
 * Without a GROQ_API_KEY the route still answers 200 with
 * `configured: false` so the UI degrades visibly instead of erroring.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAgentRound } from '@/lib/consensus/agentBroker';
import type { AgentRound } from '@/types/telemetry';

const SnapshotSchema = z.object({
  trustedValue: z.number().nullable(),
  verdict: z.enum(['NO_DATA', 'AGREEMENT', 'DEGRADED', 'FAILED']),
  agreementPct: z.number(),
  contributingCount: z.number(),
  excludedCount: z.number(),
  sensors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.enum(['normal', 'warning', 'critical', 'offline']),
    })
  ),
  gateState: z.enum(['ALLOW', 'BLOCK', 'HOLD']).nullable(),
  agents: z.array(
    z.object({
      agentId: z.string(),
      status: z.enum(['active', 'stale', 'held', 'offline']),
      consumedValue: z.number().nullable(),
    })
  ),
});

let roundCounter = 0;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'bad_json', message: 'Request body is not valid JSON' } },
      { status: 400 }
    );
  }

  const parsed = SnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_snapshot', message: 'Snapshot failed validation', details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  try {
    const result = await runAgentRound(parsed.data);
    const round: AgentRound = {
      roundId: ++roundCounter,
      finishedAt: Date.now(),
      snapshotVerdict: parsed.data.verdict,
      decisions: result.decisions,
      meta: result.meta,
      configured: result.configured,
    };
    return NextResponse.json(round);
  } catch (error) {
    // runAgentRound swallows per-agent failures; reaching here means the
    // round itself died (e.g. arbiter misbehaving) — report, never crash.
    return NextResponse.json(
      {
        error: {
          code: 'round_failed',
          message: error instanceof Error ? error.message : 'Agent round failed',
        },
      },
      { status: 502 }
    );
  }
}
