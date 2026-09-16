# PROJECT_ROADMAP.md — The GPS

> This file tracks all project phases, active work, and deliverables. Never work outside the current active phase.

---

## Phase Overview

| Phase | Description | Status |
|---|---|---|
| Phase 0 | AI Foundation System + Project Scaffolding | ✅ Complete |
| Phase 1 | Agent Reasoning Layer (LLM agents on the StateMesh) | ✅ Complete (Groq adapter) |
| Phase 2 | Consensus Engine (agent meta-consensus + arbitration) | ✅ Complete (embedded in agentBroker) |
| Phase 3 | Frontend UI + Live Data Contract | 🟡 Partial (dashboard + StateMesh + agent panel done; chat UI descoped) |
| Phase 4 | Testing + Deployment | 🟡 **ACTIVE** — tests + runbook done; rehearsal + deploy pending |

---

## Phase 0: AI Foundation System + Project Scaffolding

**Status**: ✅ **Complete**
**Goal**: Establish governance files and initialize the Next.js project

### Tasks
| # | Task | Status | Deliverable |
|---|---|---|---|
| 0.1 | Create `AI_CONTEXT.md` | ✅ Complete | Governance file with architecture, rules, tokens |
| 0.2 | Create `PROJECT_ROADMAP.md` | ✅ Complete | This file |
| 0.3 | Create `SYSTEM_LEDGER.md` | ✅ Complete | File state tracker |
| 0.4 | Create `AGENTS.md` | ✅ Complete | Agent governance rules |
| 0.5 | Initialize Next.js project with TypeScript | ✅ Complete | Next.js 15.5.23 + React 19.1.0 with App Router |
| 0.6 | Install core dependencies | ✅ Complete | zustand, framer-motion, lucide-react, clsx, tailwind-merge, cva, radix-ui |
| 0.7 | Configure Tailwind CSS + design tokens | ✅ Complete | Tailwind v4 + CSS custom properties (light/dark themes) |
| 0.8 | Create `.env.example` | ✅ Complete | NEXT_PUBLIC_WS_URL + AI key placeholders |
| 0.9 | Create basic project structure | ✅ Complete | `src/lib/`, `src/types/`, `src/components/ui/`, `src/hooks/` |
| 0.10 | Create `.gitignore` | ✅ Complete | Standard Next.js gitignore |
| 0.11 | Set up TypeScript types for telemetry | ✅ Complete | `src/types/telemetry.ts` — all domain interfaces |
| 0.12 | Build WebSocket client + Zustand store | ✅ Complete | `src/lib/ws/client.ts`, `src/lib/store/telemetryStore.ts` |
| 0.13 | Build React hooks layer | ✅ Complete | `useWebSocket.ts`, `useTelemetry.ts` (14 selector hooks) |
| 0.14 | Build UI primitive components | ✅ Complete | Card, Badge, Gauge, LiveIndicator, RiskBar |
| 0.15 | Build dashboard layout | ✅ Complete | DashboardLayout, TopBar, Sidebar |
| 0.16 | Build dashboard widgets | ✅ Complete | SensorGrid, SensorCard, ConsensusPanel, DisagreementChart, RiskGauge, ActionGate, OutlierList, ActivityFeed, StateMesh, DriftControls, ConnectionStatus, TrustedStatePanel, PhysicalActionPanel |
| 0.17 | Create mock WebSocket server | ✅ Complete | `scripts/mock-ws-server.js` — simulates 6 sensors with disagreement/consensus/risk |
| 0.18 | Verify TypeScript compiles cleanly | ✅ Complete | `tsc --noEmit` passes with zero errors |
| 0.19 | UI/UX redesign — mission-control theme | ✅ Complete | Deeper dark theme (#060a13), redesigned all 19 components, reconnection banner |
| 0.20 | Set dark mode as default | ✅ Complete | `data-theme="dark"` on `<html>`, no toggle needed for hackathon |
| 0.21 | Zod message-contract validation | ✅ Complete | `src/lib/ws/validate.ts` — discriminated union over all 11 WS message types at the time (extended to 12 by task 3.9 `consumers`); malformed frames rejected, never crash UI (`fd9ab78`) |
| 0.22 | 4-state connection model | ✅ Complete | `ConnectionState` (disconnected/connecting/connected/reconnecting) replaces boolean `wsConnected` across types → client → store → hooks → components; banner reports why the link is down (`fd9ab78`) |
| 0.23 | Re-render + reconnection hardening | ✅ Complete | `useShallow` on `useConnectionStatus`; heartbeat/onerror routed through `setConnectionState`; `ws` declared as devDependency; `mock:ws` script (`fd9ab78`) |

### Scoping Boundaries
- **In scope**: File scaffolding, governance files, project initialization, dashboard UI, WebSocket client
- **Out of scope**: AI provider implementation, API routes, testing

---

## Phase 1: Agent Reasoning Layer

**Status**: ✅ **Complete**
**Goal**: Real LLM agents consuming the broker's trusted state — the fork resolution (2026-09-15): hybrid product, "multi-modal consensus over physical reality"

> **RESOLVED**: Phase 1 was built as the agent bus on the StateMesh rather than a chat-broker. Agents: Navigator/Planner/Safety Monitor + arbiter on `openai/gpt-oss-20b` via Groq (`GROQ_API_KEY` in `.env.local`, gitignored). The `lib/ai/types.ts` ProviderAdapter keeps Anthropic (or any vendor) a drop-in for a 4th agent.

### Completed Tasks
| # | Task | Status | Deliverable |
|---|---|---|---|
| 1.1 | Shared AI provider types | ✅ Complete | `src/lib/ai/types.ts` — ProviderAdapter, AgentRole (domain decision types in `src/types/telemetry.ts` so UI never imports lib/) |
| 1.2 | Provider adapter | ✅ Complete | `src/lib/ai/groq.ts` — decide + arbitrate via json_schema strict structured output, 15 s per-call timeout, typed SDK error classes |
| 1.3 | Error handling | ✅ Complete | `src/lib/ai/errors.ts` — structured ProviderError mapping (auth/rate-limit/timeout/parse), failures degrade to visible ABSTAIN+error, never crash the round |
| 1.4 | Reasoning API route | ✅ Complete | `src/app/api/agents/decide/route.ts` — Zod-validated snapshot body, `{configured:false}` graceful degradation, structured errors (400/502) |
| 1.5 | Round engine (client) | ✅ Complete | `src/hooks/useAgentBusRounds.ts` — 12 s cadence; refuses on FAILED/NO_DATA/disconnected (zero token spend); in-flight guard; store `agentRound` slice + `useAgentRound()` |
| 1.6 | Agent decision UI | ✅ Complete | `src/components/dashboard/AgentConsensusPanel.tsx` (verdict, concurrence/dissent, rationales, WITHHELD/STALE/NOT-CONFIGURED states) + StateMesh node decision badges joined by agentId |
| 1.7 | Install provider SDK | ✅ Complete | `groq-sdk` (`@anthropic-ai/sdk` installed then removed when key switched to Groq) |
| 1.8 | Verify provider connections | ✅ Complete | Live rounds measured: AGREEMENT 3/3 PROCEED ~1.3 s/agent; DEGRADED real dissent (2 ABSTAIN vs 1 CAUTION, named LiDAR warning) arbitrated in 1.1 s; malformed snapshot → 400 |

### Scoping Boundaries
- **In scope**: adapters, types, error handling, reasoning route, decision UI
- **Out of scope**: chat interface, model fine-tuning, multi-vendor fan-out (Anthropic slot reserved, not wired)

---

## Phase 2: Consensus Engine

**Status**: ✅ **Complete** (absorbed into Phase 1's agentBroker)
**Goal**: Agent-level consensus over the sensor broker's trusted state

### Completed Tasks
| # | Task | Status | Deliverable |
|---|---|---|---|
| 2.1 | Normalized decision format | ✅ Complete | `ConsensusSnapshot` / `AgentDecision` / `AgentMetaConsensus` in `src/types/telemetry.ts` |
| 2.2–2.4 | Scoring, aggregation, broker | ✅ Complete | `src/lib/consensus/agentBroker.ts` — roster, `Promise.allSettled` fan-out, defensive per-slot failure capture, arbiter invocation; sensor-side scoring/aggregation already lives in the broker payloads + `status.ts` R1–R4 |
| 2.5 | Source attribution | ✅ Complete | Every decision carries agentId, roleName, busStatus, latency, confidence, error through WS+REST joins to both panel and mesh |

---

## Phase 3: API Layer + Frontend UI

**Status**: 🟡 **Partial — dashboard, StateMesh, agent-consensus UI + reasoning API complete**
**Goal**: Expose consensus via API and keep the dashboard the interface

### Completed Tasks
| # | Task | Status | Deliverable |
|---|---|---|---|
| 3.3 | Build dashboard layout + widgets | ✅ Complete | 13 dashboard components, 5 UI primitives, 3 layout components |
| 3.8 | Real-time consensus/risk/trusted-state visualization | ✅ Complete | `lib/consensus/status.ts` verdict derivation (AGREEMENT/DEGRADED/FAILED), ConsensusStatusBar strip, UNKNOWN refusal state, EXCLUDED sensor marking, verdict-colored StateMesh, mock-server scenario cycle (36 s loop) |
| 3.9 | StateMesh infrastructure pipeline view | ✅ Complete | 4-stage flow Sensors → Broker → Trusted State → AI Agents; additive 12-type WS contract (`consumers`/AgentState + Zod + store + useAgents), mock agent-bus emissions tied to the scenario cycle, CSS packet-dash flow with transport-loss freeze; StateMesh promoted to full-width Row 1 |
| 3.10 | Agent decision surface | ✅ Complete | AgentConsensusPanel (meta-consensus, rationales, WITHHELD/STALE/NOT-CONFIGURED states) beside StateMesh; mesh nodes carry LLM decision badges joined by agentId |
| 3.6 | Dark mode support | ✅ Complete | CSS custom properties with `data-theme="dark"`, dark as default |
| 3.7 | UI/UX redesign — professional theme | ✅ Complete | Mission-control dark theme, monospace numbers, pulse animations, reconnection banner |

### Superseded Tasks (by the 2026-09-15 hybrid fork decision — the mesh is the interface)
| # | Task | Resolution |
|---|---|---|
| 3.1 | `/api/consensus` POST endpoint | ✅ Superseded by `/api/agents/decide` (same role: Zod-validated consensus API, now for the agent layer) |
| 3.2 | `/api/providers` GET endpoint | Dropped — single provider wired; provider state is visible on the mesh itself |
| 3.4 / 3.5 | Chat interface + result display | Dropped — real-time dashboard replaced the chat story |

### Scoping Boundaries
- **In scope**: API routes, React components, styling, dark mode
- **Out of scope**: Authentication, database, deployment

---

## Phase 4: Testing + Deployment

**Status**: 🟡 **In progress** — tests ✅, demo runbook ✅; manual QA rehearsal + deploy pending
**Goal**: Verify everything works and deploy to production

### Tasks
| # | Task | Status | Deliverable |
|---|---|---|---|
| 4.1 | Write unit tests for consensus engine | ✅ Complete | `npm test` — 42 Vitest tests: `status.ts` R1–R4 boundaries + refusal invariant; simulator drift/consensus/gate math; store transport state machine (`tests/`, `a5df1f6`+`3ffbb7d`) |
| 4.2 | Write integration tests for API routes | ⏳ Deferred | Needs fetch mocks; provider round already proven live (1.8) — post-demo |
| 4.3 | Manual testing with real AI providers | ✅ Complete | Live rounds + 41-tick replays (1.8, ledger 087); control loop E2E verified live (ledger 110–114) |
| 4.4 | Deploy to Vercel | ⏳ Pending | Executed last, after local demo rehearsal; mock WS is a long-lived Node process — deployed dashboard needs a reachable WS URL, demo stays local-first |
| 4.5 | Final documentation pass | ✅ Complete | README rewritten: operator-controls explanation, 2½-min judged demo script, stress-scenario matrix, persistence-boundary note, coaching line |
| 4.6 | Operator control loop (Prompt 7) | ✅ Complete | Sliders reach the simulator: `control` frames → per-connection overlay → consensus recalculated → `overlay_state` echo; requested-vs-applied UI; offline toggle + malformed-frame injection (C1–C4) |
| 4.7 | System integration hardening (Prompt 8) | ✅ Complete | Audit fixes committed: metrics churn, stale-round mesh join, post-drop round rejection, StrictMode double-round, per-connection mock state, dead types, honest reconnect count, terminal-reconnect retry (C5 + earlier) |
| 4.8 | Stress-test all 7 scenarios (Prompt 9) | 🟡 Rehearsal pending | All mechanics implemented + pinned by 42 tests; live-verified headless (drift chain, offline electorate, both malformed paths, 0%-clear, FAILED-from-controls). One browser walk-through of the corrected README script remains |

### Scoping Boundaries
- **In scope**: Testing, deployment, documentation
- **Out of scope**: New features, architectural changes

---

## Milestones

| Milestone | Target Phase | Completion Metric | Status |
|---|---|---|---|
| Governance Foundation | Phase 0 | All 4 context files created and verified | ✅ Done |
| Project Initialized | Phase 0 | Next.js app runs locally with `npm run dev` | ✅ Done |
| Dashboard MVP | Phase 0/3 | All 9 dashboard widgets render with live WS data | ✅ Done |
| Professional UI/UX | Phase 0/3 | Mission-control theme, reconnection banner, pulse animations | ✅ Done |
| Backend ↔ Frontend Pipeline | Phase 0/3 | Dashboard receives validated live WS telemetry; reconnect + Zod contract complete | ✅ Done (`fd9ab78`) |
| Safety-State Visualization | Phase 3 | All three consensus scenarios (AGREEMENT/DEGRADED/FAILED) render live with trusted-vs-raw contrast and refusal-to-decide UNKNOWN state | ✅ Done (task 3.8) |
| Infrastructure Pipeline View | Phase 3 | StateMesh reads as the conceptual architecture (sensors → broker → trusted state → AI agents) end-to-end from live WebSocket state, agent-bus states demoed across the scenario cycle | ✅ Done (task 3.9) |
| Provider Connected | Phase 1 | Can call the LLM provider from the adapter | ✅ Done (`lib/ai/groq.ts` — live rounds measured ~1.3 s/agent) |
| Consensus Working | Phase 2 | Agents decide on the trusted state and an arbiter merges them, with dissent visible | ✅ Done (`lib/consensus/agentBroker.ts`, task 3.10) |
| API Complete | Phase 1/3 | Consensus reasoning API endpoint working with Zod validation | ✅ Done (`/api/agents/decide`) |
| Real Operator Controls | Phase 4 | Frontend controls change simulator state and the consensus genuinely recalculates (no faked verdicts) | ✅ Done (Prompts 7/8/9, `e3fefb0`→`a5df1f6`) |
| Tested | Phase 4 | `npm test` green on the honesty-critical pure logic | ✅ Done (42 tests) |
| Deployed | Phase 4 | Live URL accessible on Vercel | ⏳ Pending |

---

## Key Success Metrics

| Metric | Target |
|---|---|
| Provider response time | < 5 seconds (p95) |
| Consensus accuracy | > 85% user satisfaction on test prompts |
| Provider availability | 99% uptime across both providers |
| API response time | < 8 seconds end-to-end (including provider calls) |
| Type coverage | 100% — no `any` types in codebase |
| Error handling | 100% — all async operations wrapped in try/catch |

---

## Competitive Advantages

1. **Multi-model redundancy**: No single point of failure — if one provider goes down, the other continues
2. **Attribution transparency**: Users can see exactly which model contributed to each part of the response
3. **Pluggable architecture**: New AI providers can be added by implementing one adapter interface
4. **Consensus scoring**: Not just averaging — weighted scoring based on provider reliability and response quality
5. **Type-safe end-to-end**: TypeScript + Zod validation ensures data integrity across the entire pipeline
6. **Real-time dashboard**: Live WebSocket telemetry with consensus visualization, risk gauges, and action gates
7. **Professional mission-control UI**: Dark theme, monospace numbers, pulse animations, reconnection banner — built for hackathon demo conditions
