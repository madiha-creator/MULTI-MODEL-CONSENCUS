# Multi-Modal Consensus Broker

A real-time mission-control dashboard for **consensus over physical reality**: heterogeneous sensors must agree before a value becomes *trusted*, and LLM agents must concur (with arbitration) before that trusted state becomes a *decision*. Built for hackathon demo conditions — when consensus breaks, the system says **UNKNOWN** out loud instead of acting on a stale number.

```
Sensors ──▶ CONSENSUS BROKER ──▶ TRUSTED STATE ──▶ AI AGENTS (Navigator / Planner / Safety Monitor)
(IMU·LiDAR·      variance thresholds,      the pipeline's        each: PROCEED / CAUTION / ABSTAIN
thermal·gyro)    outlier exclusion,         product — or an       + arbiter synthesizes meta-consensus
                 verdict R1–R4               honest UNKNOWN        (openai/gpt-oss-20b via Groq)
```

## Quick start (3 terminals of fun)

```bash
npm install

# 1. mock telemetry server — 6 sensors + agent bus, 36 s scenario cycle
npm run mock:ws

# 2. dashboard
npm run dev            # → http://localhost:3000/dashboard
```

Optional — activate the LLM reasoning layer: put `GROQ_API_KEY=gsk_...` in `.env.local` (see `.env.example`). Without it the dashboard runs fully and the Agent Consensus panel honestly shows `NOT CONFIGURED` (zero API calls made).

## What you're looking at

- **ConsensusStatusBar** — the live safety verdict (AGREEMENT / DEGRADED / FAILED / NO_DATA), derived client-side from payload fields by `src/lib/consensus/status.ts` (rules R1–R4, named boundary constants).
- **StateMesh** — the infrastructure pipeline view: sensor feed edges stream packets into the broker, excluded outliers mark red, the trusted-state box refuses stale values, and agent nodes carry both wire-bus status (WebSocket) and live LLM decisions (REST) joined by id.
- **Agent Consensus** — three Claude-class agents reasoning over each snapshot every ~12 s, with concurrence/dissent counts computed from real decisions and an arbiter summary that names who disagreed and why. On FAILED, the client *skips* the API entirely — no trusted state, no reasoning, no tokens.
- Decision panels (risk gauge, action gate, physical actuator), detail panels (disagreements, outliers, activity feed, drift telemetry), and a 4-state reconnecting transport with Zod-validated wire contract (13 inbound telemetry frame types + the outbound `control`/heartbeat channel).

## Operator controls — the real loop

The **Drift & Fault Injection** panel is wired to the simulator, not faked locally:
slider → `control` frame → mock server mutates that connection's sensor overlay →
**consensus/risk/outliers/gate genuinely recalculate from the drifted values on the
next tick** → results stream back → dashboard changes. The panel distinguishes
*requested* (your local draft) from *applied* (the server's `overlay_state` echo,
with a revision counter), so the UI can never show a lie about what reached the
backend. Applying any control **pauses the scripted 36 s cycle** (mode badge reads
MANUAL); **Reset All** resumes it from the same tick.

## The 2½-minute judged demo script

Restart the mock (`npm run mock:ws`) right before starting so the clock is fresh.

| t | Move | What the audience sees |
|---|---|---|
| 0:00 | Let the auto-cycle run | "Six sensors, one trusted state. Right now they agree — verdict **AGREEMENT**, gate **ALLOW**, agents **PROCEED**." |
| 0:40 | DriftControls → pick `LiDAR Primary` → +40% → **Apply** | Mode badge flips **MANUAL** (cycle pauses — the operator owns the rig now). Within ~2 ticks: card goes CRITICAL, the sensor appears in **Outliers**, risk climbs, gate flips **BLOCK**, trusted state… still fine — the *mean of the five that agree*. |
| 1:00 | Push to a FAILED-shaped fault: **+40% drift on two more sensors** (three drifted total) | Trusted value becomes red **UNKNOWN**: three critical sensors + three outliers trips the refusal rule (critical risk with ≥2 outliers), so the broker **refuses to decide** at 50% agreement. Agent panel reads **WITHHELD** — zero LLM calls, zero tokens: "the agents won't reason over a state nobody trusts." (Drift a *fourth* sensor if you want the literal "less than half agree" headline.) |
| 1:15 | **Reset All**, then toggle one sensor offline | AUTO resumes the scripted cycle; the offline sensor shows **OFFLINE** (sidebar count +1), and the consensus ratio honestly reads 5/5 = 100% — "absent is not disagreeing; the broker shrank its electorate." |
| 1:40 | **Inject malformed frame** (diagnostic button, twice) | ConnectionStatus's **Invalid frames** counter ticks — one click exercises the Zod schema-rejection path, the next the JSON parse-failure path. Store untouched, UI never flickers. "Bad data cannot reach the verdict." |
| 2:00 | Kill `npm run mock:ws` (Ctrl+C), wait ~3 s, restart it | Mesh freezes and dims, **Data frozen — Ns** counts up, Reconnect banner + **RETRY NOW**; on restart everything recolors live and **Reconnects** reads exactly 1 — the counter counts completed recoveries, not failed attempts. |
| 2:20 | Close on the agent panel mid-FAILED, then Reset All | "A dashboard that shows agreement is common. One that *refuses to display a number it doesn't trust* — and tells you why — is the product." |

**Coaching line** if a judge asks why the verdict lags the slider a second or two:
the lag *is* the derivation — nothing announces a verdict; it is re-computed from
payload fields every tick, which is exactly why it can't be faked.

**Pre-demo checklist:** fresh `npm run mock:ws` restart · `npm run typecheck` · `npm test` · one dev server, no stray tabs (overlay state is per-connection) · `.env.local` with `GROQ_API_KEY` present (else the panel honestly shows NOT CONFIGURED).

## Stress scenarios covered

| # | Scenario | How |
|---|---|---|
| 1 | All sensors agree | auto-cycle AGREEMENT phase |
| 2 | One sensor drifts | manual slider *and* scripted DEGRADED phase |
| 3 | Multiple disagree | scripted FAILED phase / stacked manual faults |
| 4 | Sensor disconnects | offline toggle → excluded from the denominator, never an outlier |
| 5 | WS disconnects | kill mock → frozen-data clock, RETRY NOW, truthful Reconnects |
| 6 | Malformed telemetry | inject button → alternating schema-invalid + unparseable frames → counter ticks, store untouched |
| 7 | Recovery | Reset All resumes the cycle; mock restart reconnects ≤2 s, verdicts recolor |

## Persistence boundary (deliberate)

No database yet — the store has one marked seam (`// PERSISTENCE SEAM` in
`telemetryStore.ts`) where `zustand/middleware persist` attaches without touching
the wire contract or any panel. Event history across restarts is on the roadmap,
not in the demo path.

## Tests

`npm test` — 42 pure-logic tests (Vitest, no DOM): every R1–R4 verdict boundary
in `status.ts`, the simulator's exported drift/consensus/gate math, and the
store's transport state machine (reconnect accounting, echo invalidation, churn
guards) — the three layers the demo's honesty claim rests on.

## Deploying (portfolio artifact — demo stays local-first)

The dashboard builds for Vercel with `GROQ_API_KEY` as a project env var, but the
mock simulator is a long-lived Node process serverless can't host, and
`NEXT_PUBLIC_WS_URL` is inlined at **build** time. A deployed page therefore
points at the *viewer's own* `localhost:8080` unless rebuilt with a reachable WS
URL — run the demo locally; deploy the code, not the telemetry.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Next.js dev server (port 3000) |
| `npm run build` | Production build (TS-checked) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — pure-logic tests (verdict rules + drift math), no server needed |
| `npm run mock:ws` | Mock telemetry WebSocket server (port 8080) |

## Architecture map

| Layer | Lives in |
|---|---|
| Wire contract (13 inbound types + control, Zod-validated) | `src/types/telemetry.ts` · `src/lib/ws/validate.ts` · `src/lib/ws/client.ts` |
| Live state (Zustand) | `src/lib/store/telemetryStore.ts` + selector hooks in `src/hooks/` |
| Sensor-side consensus | `src/lib/consensus/status.ts` (verdict R1–R4) + broker payloads |
| LLM-side consensus | `src/lib/ai/` (ProviderAdapter, Groq adapter) · `src/lib/consensus/agentBroker.ts` · `src/app/api/agents/decide/route.ts` |
| Visualization | `src/components/dashboard/` (StateMesh, AgentConsensusPanel, + 12 panels) |
| Simulated backend | `scripts/mock-ws-server.js` (CommonJS; `SCENARIO_ENABLED=false` for raw-random mode) |

Governance: this repo runs an AI-agent workflow — read `AI_CONTEXT.md` (constitution), `PROJECT_ROADMAP.md` (GPS), `SYSTEM_LEDGER.md` (memory), `AGENTS.md` (rules) before touching anything.
