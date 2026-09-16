# SYSTEM_LEDGER.md — The Memory

> This file tracks the exact state of the project across sessions. Update it before every session ends.

---

## Current State

| Metric | Value |
|---|---|
| **Active Phase** | Phase 4 — Testing + Deployment (Phases 1–3 closed 2026-09-15) |
| **Source Files** | 40 (.ts/.tsx under src/; 41 tracked incl. `src/app/favicon`-free layout files — git ls-files src = 41) |
| **Script Files** | 1 (`scripts/mock-ws-server.js`, 699 lines — operator controls + per-connection state) |
| **Config Files** | 8 tracked (package.json, package-lock.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.mts, .gitignore, .env.example) |
| **Governance Docs** | 4 (AI_CONTEXT.md, PROJECT_ROADMAP.md, SYSTEM_LEDGER.md, AGENTS.md) |
| **Test Files** | 3 (`consensus-status` 13 its, `mock-drift` 23, `telemetry-store` 6) — 42 tests |
| **Total Lines of Code** | 4,956 (src 4,257 + script 699) + 495 test LOC |
| **Test Status** | ✅ `npm test` green — 42/42 (2026-09-15). Verdict rules R1–R4 + simulator drift/gate math + store transport state machine (reconnect accounting, echo invalidation, churn guards). Live E2E: drift +30% → stable magnitude 0.30, lidar-01 excluded ratio 0.83; malformed clicks yield ["schema","parse"] on the wire; 0% drift stays AUTO |
| **Build Status** | `tsc --noEmit` zero errors; `next build` clean (`ignoreBuildErrors: false`); ESLint still skipped in builds (no flat config — Known Issue #1 remainder) |
| **Git** | master, 17 commits as of `3ffbb7d` (audit-fix transport truth) + this docs close-out — Prompt 7/8/9 = e444a21→de41f7a. `.claude/` hidden by global gitignore; `.agents/` + `skills-lock.json` untracked tooling (repo `.gitignore` deliberately not extended — user hasn't asked) |
| **Prompt 4 Status** | ✅ Complete — backend → WS → service → state → dashboard pipeline committed (`fd9ab78`) |
| **Prompt 5 Status** | ✅ Complete — committed (`3a57db3`) |
| **Prompt 6 Status** | ✅ Complete — committed (`b1da37b` + `ecdf837`) |
| **Fork Decision** | ✅ RESOLVED (2026-09-15) — (c) Hybrid: real LLM agents on the mesh; provider = Groq (openai/gpt-oss-20b) per user's key |
| **Phase 1/2 Status** | ✅ Complete — agent reasoning layer live (adapter, broker, route, round engine, panel, mesh badges) |
| **Dependencies** | 13 production (incl. groq-sdk), 10 dev (incl. vitest) |
| **Last Updated** | 2026-09-15 |

---

## File Ledger

| # | Action | File Path | Timestamp | Justification |
|---|---|---|---|---|
| 001 | Created | `AI_CONTEXT.md` | 2026-09-14 | Constitution file — architecture, rules, design tokens, session management |
| 002 | Created | `PROJECT_ROADMAP.md` | 2026-09-14 | GPS file — phase overview, active phase, milestones, success metrics |
| 003 | Created | `SYSTEM_LEDGER.md` | 2026-09-14 | Memory file — file state, known issues, next actions |
| 004 | Created | `AGENTS.md` | 2026-09-14 | Agent governance — authenticity, planning, boot sequences, scope control |
| 005 | Created | `.gitignore` | 2026-09-14 | Standard Next.js gitignore (node_modules, .next, .env, etc.) |
| 006 | Created | `.env.example` | 2026-09-14 | Environment variable template — NEXT_PUBLIC_WS_URL, AI key placeholders |
| 007 | Created | `next-env.d.ts` | 2026-09-14 | Next.js auto-generated type references |
| 008 | Created | `src/types/telemetry.ts` | 2026-09-14 | All domain types — SensorReading, ConsensusState, RiskAssessment, ActionGate, Outlier, TelemetryEvent, WSMessage union |
| 009 | Created | `src/lib/ws/client.ts` | 2026-09-14 | WebSocket client class — auto-reconnect with exponential backoff, heartbeat, timeout detection |
| 010 | Created | `src/lib/store/telemetryStore.ts` | 2026-09-14 | Zustand store — all telemetry state, message routing, event buffer (max 100) |
| 011 | Created | `src/hooks/useWebSocket.ts` | 2026-09-14 | React hook — initializes WS client, wires messages to store, manages lifecycle |
| 012 | Created | `src/hooks/useTelemetry.ts` | 2026-09-14 | 14 selector hooks — useSensors, useConsensus, useRisk, useActionGate, useOutliers, useEvents, useDisagreements, useConnectionStatus, useActiveAlertCount, useDriftConfig, useDriftState, useActuatorState, useConnectionMetrics, useUpdateDriftConfig |
| 013 | Created | `src/components/ui/Card.tsx` | 2026-09-14 | Reusable card wrapper — optional title + badge slot, border styling |
| 014 | Created | `src/components/ui/Badge.tsx` | 2026-09-14 | Status badge — 5 variants (default, success, warning, error, info) |
| 015 | Created | `src/components/ui/Gauge.tsx` | 2026-09-14 | SVG circular gauge — framer-motion animated, color-coded by threshold |
| 016 | Created | `src/components/ui/LiveIndicator.tsx` | 2026-09-14 | Pulsing dot — green (connected) / red (disconnected) |
| 017 | Created | `src/components/ui/RiskBar.tsx` | 2026-09-14 | Horizontal risk bar — color-coded fill with level label |
| 018 | Created | `src/components/layout/DashboardLayout.tsx` | 2026-09-14 | Main dashboard shell — connects WebSocket, composes TopBar + Sidebar + all widgets |
| 019 | Created | `src/components/layout/TopBar.tsx` | 2026-09-14 | Top header — project title, alert count badge, live connection indicator |
| 020 | Created | `src/components/layout/Sidebar.tsx` | 2026-09-14 | Left sidebar — nav links, system status panel, sensor health summary |
| 021 | Created | `src/components/dashboard/SensorGrid.tsx` | 2026-09-14 | Responsive grid — maps sensors to SensorCard components |
| 022 | Created | `src/components/dashboard/SensorCard.tsx` | 2026-09-14 | Individual sensor — name, value, unit, status badge, confidence bar |
| 023 | Created | `src/components/dashboard/ConsensusPanel.tsx` | 2026-09-14 | Consensus display — trusted value, confidence bar, contributing/excluded counts |
| 024 | Created | `src/components/dashboard/DisagreementChart.tsx` | 2026-09-14 | Sensor pair disagreements — variance values, active count badge |
| 025 | Created | `src/components/dashboard/RiskGauge.tsx` | 2026-09-15 | Risk assessment — Gauge + RiskBar + factors list |
| 026 | Created | `src/components/dashboard/ActionGate.tsx` | 2026-09-15 | Action gate — ALLOW/BLOCK/HOLD with icon, reason, trigger source |
| 027 | Created | `src/components/dashboard/OutlierList.tsx` | 2026-09-15 | Outlier display — flagged sensors with deviation and reason |
| 028 | Created | `src/components/dashboard/ActivityFeed.tsx` | 2026-09-15 | Event log — timestamped events with severity icons, scrollable |
| 029 | Created | `src/components/dashboard/StateMesh.tsx` | 2026-09-15 | SVG sensor network — nodes with confidence, disagreement edges, central hub |
| 030 | Created | `scripts/mock-ws-server.js` | 2026-09-15 | Mock WebSocket server — 6 simulated sensors, all 11 message types |
| 031 | Modified | `src/app/globals.css` | 2026-09-15 | UI/UX redesign — deeper dark theme (#060a13), mission-control colors, pulse-border animation, flash-in animation |
| 032 | Modified | `src/components/layout/DashboardLayout.tsx` | 2026-09-15 | Restructured to 5-row grid, added ReconnectBanner, wired 4 new components |
| 033 | Modified | `src/components/layout/TopBar.tsx` | 2026-09-15 | Compact h-12, uppercase tracked title, cleaner alert badge |
| 034 | Modified | `src/components/layout/Sidebar.tsx` | 2026-09-15 | Narrower w-52, tighter spacing, monospace numbers, 10px section labels |
| 035 | Modified | `src/components/dashboard/SensorCard.tsx` | 2026-09-15 | border-l-[3px], text-2xl value, 1px confidence bar, tighter padding |
| 036 | Modified | `src/components/dashboard/ConsensusPanel.tsx` | 2026-09-15 | text-5xl trusted value, removed framer-motion for instant updates |
| 037 | Modified | `src/components/dashboard/RiskGauge.tsx` | 2026-09-15 | 110px gauge, red factor pills, cleaner layout |
| 038 | Modified | `src/components/dashboard/ActionGate.tsx` | 2026-09-15 | border-2, instant color swap, animate-pulse-border on BLOCK, ShieldCheck/ShieldOff icons |
| 039 | Modified | `src/components/dashboard/DisagreementChart.tsx` | 2026-09-15 | Scrollable list, 1.5px status dots, tabular-nums for variance |
| 040 | Modified | `src/components/dashboard/OutlierList.tsx` | 2026-09-15 | Scrollable, cleaner row layout, tabular-nums for deviation |
| 041 | Modified | `src/components/dashboard/ActivityFeed.tsx` | 2026-09-15 | max-h-60 (taller), 50 events, truncate on long messages |
| 042 | Modified | `src/components/dashboard/StateMesh.tsx` | 2026-09-15 | 800x300 viewBox, 28px node rings, 5px inner dots, Geist Mono for confidence |
| 043 | Modified | `src/components/dashboard/SensorGrid.tsx` | 2026-09-15 | xl:grid-cols-3 responsive breakpoint |
| 044 | Modified | `src/components/ui/Card.tsx` | 2026-09-15 | Tighter p-3, mb-2.5 header gap |
| 045 | Modified | `src/components/ui/Badge.tsx` | 2026-09-15 | text-[10px], uppercase tracked, bg-15% opacity |
| 046 | Modified | `src/components/ui/Gauge.tsx` | 2026-09-15 | Geist Mono font, tabular-nums, text-[9px] label |
| 047 | Modified | `src/components/ui/LiveIndicator.tsx` | 2026-09-15 | Smaller h-2 w-2 |
| 048 | Modified | `src/components/ui/RiskBar.tsx` | 2026-09-15 | 1.5px bar height, text-[10px] labels |
| 049 | Created | `src/components/dashboard/DriftControls.tsx` | 2026-09-14 | Drift controls — 3 sliders (sensitivity, time window, correction) + live drift magnitude display |
| 050 | Created | `src/components/dashboard/ConnectionStatus.tsx` | 2026-09-14 | Connection metrics — latency, uptime, messages, reconnects with color-coded indicators |
| 051 | Created | `src/components/dashboard/TrustedStatePanel.tsx` | 2026-09-14 | Standalone trusted state — 4xl mono value, confidence bar, contributing/excluded counts |
| 052 | Created | `src/components/dashboard/PhysicalActionPanel.tsx` | 2026-09-14 | Physical action — gate state + actuator status (motor rpm, servo angle, e-stop) |
| 053 | Modified | `src/types/telemetry.ts` | 2026-09-14 | Added SensorType, DriftConfig, DriftState, ActuatorState, ConnectionMetrics + 3 WSMessage variants |
| 054 | Modified | `src/lib/store/telemetryStore.ts` | 2026-09-14 | Added driftConfig, driftState, actuatorState, connectionMetrics + updateDriftConfig action |
| 055 | Modified | `src/hooks/useTelemetry.ts` | 2026-09-14 | Added useDriftConfig, useDriftState, useActuatorState, useConnectionMetrics, useUpdateDriftConfig |
| 056 | Modified | `scripts/mock-ws-server.js` | 2026-09-14 | Added sensorType, drift_state, actuator_state, connection_metrics generation |
| 057 | Modified | `src/app/globals.css` | 2026-09-14 | Added --color-text CSS variable (alias of --color-text-primary) for light + dark themes |
| 058 | Modified | `src/components/dashboard/PhysicalActionPanel.tsx` | 2026-09-14 | Removed unused Zap import from lucide-react |
| 059 | Created | `src/lib/ws/validate.ts` | 2026-09-14 | Zod discriminated-union schemas for all 11 WS message types; validateMessage() rejects malformed frames with a warning |
| 060 | Modified | `src/types/telemetry.ts` | 2026-09-14 | Added ConnectionState union (disconnected/connecting/connected/reconnecting); TelemetryStore interface uses connectionState + setConnectionState |
| 061 | Modified | `src/lib/ws/client.ts` | 2026-09-14 | Zod validation on inbound frames; 4-state connection model; heartbeat timeout routed through setConnectionState; onerror delegates to onclose |
| 062 | Modified | `src/lib/store/telemetryStore.ts` | 2026-09-14 | wsConnected → connectionState; exhaustive never-check in message router default branch |
| 063 | Modified | `src/hooks/useWebSocket.ts` | 2026-09-14 | Wires setConnectionState instead of setWsConnected |
| 064 | Modified | `src/hooks/useTelemetry.ts` | 2026-09-14 | useConnectionStatus wrapped in useShallow (stops per-tick re-renders); added useConnectionState |
| 065 | Modified | `src/components/layout/TopBar.tsx`, `Sidebar.tsx`, `DashboardLayout.tsx`, `src/components/dashboard/ConnectionStatus.tsx` | 2026-09-14 | Surface all 4 connection states; ReconnectBanner reports why the link is down |
| 066 | Modified | `package.json` | 2026-09-14 | Added zod@4.6.5 (dep), ws@8.21.3 (devDep, was undeclared), mock:ws script |
| 067 | — | **Committed `fd9ab78`** — "feat: harden WebSocket integration" (12 files, +294/−68), `tsc --noEmit` clean | 2026-09-14 | Prompt 4 complete: backend → WS → service → state → dashboard pipeline verified end-to-end against mock server |
| 068 | Modified | `PROJECT_ROADMAP.md`, `SYSTEM_LEDGER.md` | 2026-09-14 | Session close-out — roadmap records tasks 0.21–0.23 + Backend↔Frontend Pipeline milestone + Phase 1 scope-decision block; ledger Next Actions re-prioritized (scope decision first; zod/ws installs dropped as done) |
| 069 | Created | `src/lib/consensus/status.ts` | 2026-09-14 | Prompt 5 — pure frontend verdict derivation (AGREEMENT/DEGRADED/FAILED/NO_DATA) from live payload fields; rule table R1–R4 with named boundary constants (RATIO_FAIL_MAX 0.5, RATIO_AGREE_MIN 0.95); verdictStyles token map; no UI imports (lib boundary respected) |
| 070 | Created | `src/components/dashboard/ConsensusStatusBar.tsx` | 2026-09-14 | Full-width safety verdict strip — verdict word + live headline + risk/action/trusted-value chips (bold red UNKNOWN on FAILED), outlier-name badges, flash-in on transition via key remount |
| 071 | Modified | `src/hooks/useTelemetry.ts` | 2026-09-14 | Added useConsensusVerdict (useShallow over primitive-only Verdict — no per-tick re-render churn) |
| 072 | Modified | `src/components/dashboard/ConsensusPanel.tsx` | 2026-09-14 | Verdict badge replaces "% agree"; trusted value shown as toFixed(2) labeled "unitless demo" (was meaningless ×100); UNKNOWN on FAILED; 0-count chips dimmed; refusal-to-decide callout |
| 073 | Modified | `src/components/dashboard/TrustedStatePanel.tsx` | 2026-09-14 | Verdict badge replaces STRONG/MODERATE/WEAK; same UNKNOWN rule; "Trusted from" contributing-id list when not full agreement; honest value formatting |
| 074 | Modified | `src/components/dashboard/SensorGrid.tsx`, `SensorCard.tsx` | 2026-09-14 | Grid derives excludedSet/outlierSet from consensus+outliers; card gets optional isExcluded/isOutlier props — red ring + EXCLUDED badge (raw reading kept visible at 50% opacity = contrast), amber ring for flagged |
| 075 | Modified | `src/components/dashboard/StateMesh.tsx` | 2026-09-14 | Hub circle/label colored by verdict (was static blue "HUB"); excluded nodes dashed + faded |
| 076 | Modified | `src/components/dashboard/ActivityFeed.tsx` | 2026-09-14 | Newest row gets animate-flash (activates previously unused keyframe) |
| 077 | Modified | `src/components/layout/DashboardLayout.tsx` | 2026-09-14 | ConsensusStatusBar inserted as Row 0 above SensorGrid |
| 078 | Modified | `scripts/mock-ws-server.js` | 2026-09-14 | Scenario-cycle mode (SCENARIO_ENABLED, default on; 36-tick AGREEMENT→DEGRADED→FAILED loop; DEGRADED victim = lidar-02 gradual +45% drift; FAILED victims ×4 hard split); trustedValue = mean of contributing (was a copy of agreementRatio); risk +60 when ratio<0.5 / +20 when <0.95 (critical now reachable); gate BLOCK on critical or high+outliers; phase events; wire contract (all 11 message shapes) unchanged — validate.ts untouched; SCENARIO_ENABLED=false restores legacy random mode |
| 079 | Modified | `src/types/telemetry.ts` | 2026-09-15 | Prompt 6 — AgentStatus ('active'/'stale'/'held'/'offline') + AgentState (consumedValue null ⇔ held/offline, no silent old numbers); WSMessage widened to 12 types with additive `consumers` variant; TelemetryStore mirror gains `agents` |
| 080 | Modified | `src/lib/ws/validate.ts` | 2026-09-15 | AgentStateSchema + `consumers` entry in the discriminated union — without this Zod would silently drop the new frames (agents column dead-on-arrival trap) |
| 081 | Modified | `src/lib/store/telemetryStore.ts` | 2026-09-15 | `agents` slice (initialState + interface) and `case 'consumers'` wholesale-replace — required by the exhaustive-never default branch |
| 082 | Modified | `src/hooks/useTelemetry.ts` | 2026-09-15 | Added useAgents() one-line selector (same identity style as useSensors) |
| 083 | Modified | `src/app/globals.css` | 2026-09-15 | StateMesh pipeline animations: .pipeline-flow (zero-length round-cap dash packets marching via stroke-dashoffset — pure CSS, no framer-motion/rAF), .pipeline-alert (disagreement edge pulse), .pipeline-node-pulse (broker per-tick processing flash), .pipeline-paused/.pipeline-dim (transport loss), prefers-reduced-motion block (dots stay painted static) |
| 084 | Rewritten | `src/components/dashboard/StateMesh.tsx` | 2026-09-15 | Radial hub-and-spoke → 4-stage left-to-right infrastructure pipeline (1000×360 viewBox): sensors → CONSENSUS BROKER (verdict-colored, key-remount pulse ring per consensus frame) → TRUSTED STATE (largest/thickest element = the product; shows v.trustedValue so FAILED/NO_DATA ⇒ red UNKNOWN, never stale) → AI AGENTS bus (active/stale/held/offline styling). Sensor feed edges encode streaming/offline/excluded/disagreement — old sensor↔sensor red lines retired (bad data now marked at its feed into the broker). Legend row + LiveIndicator badge; packet flow freezes + mesh dims when transport down |
| 085 | Modified | `src/components/layout/DashboardLayout.tsx` | 2026-09-15 | StateMesh promoted from Row 4 ⅓-slot to full-width Row 1 (under ConsensusStatusBar); detail row now 2-col (DisagreementChart \| OutlierList) |
| 086 | Modified | `scripts/mock-ws-server.js` | 2026-09-15 | Agent bus: AGENTS roster (Navigator/Planner/Safety Monitor) + generateConsumers(phase, consensus) — AGREEMENT all active; DEGRADED agent-b stale (−6% value, lastSync −3 s); FAILED agent-a/b held (null), agent-c offline; `consumers` broadcast every tick (messageCount 8→9); header comment now 12 message types |
| 087 | — | **Verified (uncommitted)** | 2026-09-15 | Prompt 6: `tsc --noEmit` clean, `next build` clean (/dashboard 80 kB); 41-tick live replay captured per-phase agent states (AGREEMENT active×3 208.82 · DEGRADED stale 239.25 vs 254.52 · FAILED held×2+offline · wrap clean); Zod accepts live consumers frames 3/3; GET /dashboard 200 |
| 088 | — | **Decision** | 2026-09-15 | Phase 1 fork RESOLVED with user: **(c) Hybrid — real LLM agents on the mesh**. Sensor-consensus dashboard stays the product; Claude-class agents consume the trusted state via the StateMesh `consumers` bus (the Prompt 6 seam). Provider switched to Groq on user request (`GROQ_API_KEY`, openai/gpt-oss-20b) — @anthropic-ai/sdk installed then removed; anthropic.ts adapter replaced by groq.ts; ProviderAdapter keeps Anthropic a drop-in later |
| 089 | Created | `src/lib/ai/types.ts` | 2026-09-15 | Phase 1 — ProviderAdapter interface + AgentRole (constitution adapter pattern; domain types live in types/telemetry.ts so components never import lib/; lib never imports UI) |
| 090 | Created | `src/lib/ai/errors.ts` | 2026-09-15 | Structured ProviderError mapping (auth/rate_limited/timeout/parse/… with retryable flag) using typed groq-sdk classes — one failed agent call degrades to a visible ABSTAIN, never crashes a round |
| 091 | Created | `src/lib/ai/groq.ts` | 2026-09-15 | Groq adapter — 3 role decisions + arbiter per round via json_schema strict structured output (zod→toJSONSchema), 15 s/call ceiling, not_configured path returns visible ABSTAIN without touching the network; model openai/gpt-oss-20b (measured ~1.3 s/decision, ~0.4 s generation) |
| 092 | Created | `src/lib/consensus/agentBroker.ts` | 2026-09-15 | Reasoning-round orchestrator — AGENT_ROLES roster (agent-a/b/c matching wire ids), Promise.allSettled fan-out, defensive per-slot failure capture, arbiter meta-consensus with truthful rule-computed concurrence/dissent (absorbs roadmap 2.2–2.5) |
| 093 | Created | `src/app/api/agents/decide/route.ts` | 2026-09-15 | POST /api/agents/decide — Zod-validated ConsensusSnapshot body (400 with fieldErrors), returns AgentRound (per-decision attribution: decision/rationale/confidence/latencyMs/error/busStatus); configured:false passthrough; never 500s on agent failures |
| 094 | Created | `src/hooks/useAgentBusRounds.ts` | 2026-09-15 | Client round engine — 12 s cadence via store getState() (zero extra re-renders); pauses on transport loss, skips NO_DATA, and skips FAILED outright (broker refused ⇒ no reasoning, zero token spend — panel shows WITHHELD); in-flight guard; 40 s abort; stale rounds age on the consumer side |
| 095 | Created | `src/components/dashboard/AgentConsensusPanel.tsx` | 2026-09-15 | Judges' panel — meta-consensus headline (recommendation + concurrence/dissent + arbiter summary or honest "rule-based tally" marker), per-agent decision rows (FAILED ≠ ABSTAIN), WITHHELD/AWAITING ROUND/STALE/NOT CONFIGURED states, 1 Hz staleness clock |
| 096 | Modified | `src/types/telemetry.ts` | 2026-09-15 | Reasoning-layer domain types: DecisionWord, AgentDecision, AgentMetaConsensus, AgentRound, ConsensusSnapshot; TelemetryStore mirror gains agentRound + setAgentRound |
| 097 | Modified | `src/lib/store/telemetryStore.ts` | 2026-09-15 | agentRound slice (REST reasoning state kept separate from WS wire state) + setAgentRound action |
| 098 | Modified | `src/hooks/useTelemetry.ts` | 2026-09-15 | useAgentRound selector |
| 099 | Modified | `src/components/dashboard/StateMesh.tsx` | 2026-09-15 | Agent nodes join LLM decisions onto wire status by agentId: decision line (PROCEED/CAUTION/ABSTAIN + confidence, NO-DECISION on provider error), accent side-bar; badges withheld when broker refuses or round unconfigured; box height 44→54 |
| 100 | Modified | `src/components/layout/DashboardLayout.tsx` | 2026-09-15 | useAgentBusRounds() mounted; Row 1 becomes xl:grid-cols-4 (StateMesh span-3 + AgentConsensusPanel span-1) |
| 101 | Modified | `package.json` | 2026-09-15 | +groq-sdk (dep); @anthropic-ai/sdk added then removed same session (key swap) |
| 102 | Modified | `next.config.ts` | 2026-09-15 | ignoreBuildErrors → false (Known Issue #1 TS half fixed — typecheck already green; eslint still ignored, no flat config exists yet) |
| 103 | Modified | `src/components/dashboard/DriftControls.tsx` | 2026-09-15 | Title honestly labeled "client-side simulation" (sliders don't reach the mock server yet — placebo risk before judges) |
| 104 | Modified | `.env.example` | 2026-09-15 | GROQ_API_KEY documented as the active key; Anthropic slot marked reserved-not-wired |
| 105 | Created | `README.md` | 2026-09-15 | Setup, 36 s demo script, architecture map, degradation-visibility notes (was missing entirely) |
| 106 | Modified | `AI_CONTEXT.md` | 2026-09-15 | Constitution re-scoped to the hybrid fork (user-approved): identity = two-stage consensus (sensors→trusted state→agents), actual src/ directory tree, Groq provider table, new fallback chain (FAILED skips API), design-token section annotated with globals.css as authority |
| 107 | Modified | `PROJECT_ROADMAP.md` | 2026-09-15 | Phase 1 rewritten + ✅ (1.1–1.8), Phase 2 absorbed + ✅, Phase 3 task 3.10 + superseded-task table (3.1 done-as-decide-route, 3.2/3.4/3.5 dropped per fork), Phase 4 marked next, milestones updated (Provider/Consensus/API Done) |
| 108 | — | **Verified** | 2026-09-15 | Phase 1/2 live: malformed body → 400 invalid_snapshot; AGREEMENT round 3/3 PROCEED (0.95–0.98, ~1.0–1.3 s/agent, arbitrated 0.7 s); DEGRADED round produced REAL dissent (Navigator+Planner ABSTAIN vs Safety Monitor CAUTION, arbiter named the LiDAR warning); dev log shows /api/agents/decide 200s at 2–3 s; tsc clean; next build clean with ignoreBuildErrors:false (route shows ƒ dynamic) |
| 109 | — | **Committed `e444a21`** — baseline | 2026-09-15 | 21 pending Phase 1/2 files (agent layer + docs) committed before Prompt 7/8/9 work so feature diffs stay clean; `.env.local` verified gitignored, key never committed |
| 110 | Modified | `src/types/telemetry.ts`, `src/lib/ws/validate.ts`, `src/lib/store/telemetryStore.ts`, `src/hooks/useTelemetry.ts`, `src/components/dashboard/DriftControls.tsx` | 2026-09-15 | **C1 `e3fefb0`** — contract: deleted dead `DriftConfig`/`TelemetryStore` types; `ControlAction`/`ControlMessage` (outbound) + `OverlayState` + 13th inbound frame `overlay_state`; `validateControl()` send pre-flight; invalid-frame handler seam (`setInvalidFrameHandler`/`notifyInvalidFrame`); store: `overlayState`/`reconnectCount`/`invalidFrameCount`, connectionMetrics churn fix (only heartbeat/metrics clone it), reconnectCount honest, `// PERSISTENCE SEAM` comment |
| 111 | Created | `src/lib/ws/sender.ts` | 2026-09-15 | **C2 `0657e2d`** — active-client singleton; `sendControl()` = build → validate → isOpen → send, false when unreachable (placebo loop's missing piece) |
| 112 | Modified | `src/lib/ws/client.ts`, `src/hooks/useWebSocket.ts`, `src/components/layout/DashboardLayout.tsx` | 2026-09-15 | **C2** — `retry()` fixes terminal-after-10-attempts dead end ("RETRY NOW" on banner); parse-failure path reports `notifyInvalidFrame('parse')` (was silent catch) |
| 113 | Rewritten | `scripts/mock-ws-server.js` | 2026-09-15 | **C3 `e2a2d44`** — per-connection tickCount/realTicks/eventId (multi-tab no longer runs N× speed); mirrored Zod `control` handler (`// MIRROR`); overlay map + offline set + revision, manual mode pauses the scripted cycle; `generateBaselineSensors` + `applyOperatorState` (drift conf 0.95−|pct|·0.015 mirrors the DEGRADED slope ⇒ ≥~24% crosses the 0.6 floor through the REAL pipeline); honest measured `generateDriftState`; `consumersStoryFor` ties bus story to actual ratio; offline excluded from outliers + disagreement pairs; broadcasts `overlay_state` + operator events; `require.main` guard + helper exports for tests |
| 114 | Rewritten | `src/components/dashboard/DriftControls.tsx` | 2026-09-15 | **C4 `7f08f30`** — "Drift & Fault Injection — operator controls": sensor select, −50/+50 slider Apply/Clear, offline toggle, Reset All, malformed-frame diagnostic; requested (local draft) vs applied (overlay echo + revision) shown distinctly; MANUAL/AUTO badge; the "client-side simulation" disclaimer retires — Prompt 7 complete |
| 115 | Modified | `src/components/layout/Sidebar.tsx`, `src/components/dashboard/ConnectionStatus.tsx` | 2026-09-15 | **C4** — OFFLINE count chip; Reconnects truthful, Invalid frames row (amber >0), "Data frozen — Ns" staleness row |
| 116 | Modified | `src/components/dashboard/StateMesh.tsx`, `src/hooks/useAgentBusRounds.ts` | 2026-09-15 | **C5 `c5f173f`** — integration audit remainder: mesh joins LLM badges only from rounds fresher than ROUND_STALE_MS; a round resolving after transport loss is dropped, not committed; module-level stamp dedupes StrictMode double-boot round (single dev-boot /api/agents/decide POST) |
| 117 | Created | `tests/consensus-status.test.ts`, `tests/mock-drift.test.ts`, `vitest.config.mts`; `package.json` (+vitest devDep, `"test": "vitest run"`) | 2026-09-15 | **C6 `a5df1f6`** — 31 pure-logic tests green: R1–R4 every clause + both boundary constants + refusal invariant; phaseAt 19/20/29/30/35/36/90 wrap, overlay math exact values (17.22/0.35/critical), offline electorate (5/5 ratio, no outlier, ALLOW), blackout NaN guard, drift magnitude measured 0.4/negative/none, gate BLOCK on +40 drift |
| 118 | Modified | `src/lib/ws/client.ts`, `src/lib/store/telemetryStore.ts`, `scripts/mock-ws-server.js`, `src/types/telemetry.ts`, `src/components/dashboard/AgentConsensusPanel.tsx`, `tests/` (+telemetry-store.test.ts) | 2026-09-15 | **A-to-Z audit fix `3ffbb7d`** — three adversarial audits (repo/secrets: CLEAN, no secrets in HEAD or history; wiring: 13/13 contract aligned, 6 defects found; docs: demo script misdescribed reaching FAILED). Fixed: dying-client onclose leak (StrictMode banner/overlay flash); reconnectCount counts COMPLETED recoveries not attempts (hasConnected guard); overlay echo cleared on ANY non-connected state (per-connection mock truth); overlay/consumers identity-churn guards (1 Hz re-render stopped); set_drift 0% clears instead of freezing the cycle; stale claims retired (clamp/reject, outbound contract, DEGRADED first-ticks ramp, "Claude agents"). +11 tests → 42. Live-verified: 0%-drift keeps AUTO, AUTO revisions stable, 3×+40% ⇒ verdict FAILED w/ null trustedValue |
| 119 | Modified | `README.md`, `SYSTEM_LEDGER.md`, `AI_CONTEXT.md`, `PROJECT_ROADMAP.md` | 2026-09-15 | **A-to-Z docs close-out (this commit)** — demo script 1:00 rewritten to the true FAILED recipe (offline-only can't drop ratio: it shrinks both numerator and denominator — verified by audit math + new test); 1:40 click-twice (schema+parse); 31→42 test count synced; contract counts corrected (13 inbound + control/heartbeat outbound, was "12-type" in AI_CONTEXT); Current State numbers re-measured; roadmap 4.8 marked honestly pending one live rehearsal; README deploy note (NEXT_PUBLIC_WS_URL inlined at build time; mock stays local) |
| 120 | — | **Operational** | 2026-09-15 | Dev server recovered after the 20:19 `npm run build` clobbered its live `.next` (dashboard 500, browser `a[d] is not a function`; cause: `ENOENT .next/server/vendor-chunks/zod.js`). Killed dev, wiped `.next`, restarted → `/dashboard` 200, log clean, control loop re-verified (`set_drift` → rev-1 manual echo). No source touched; Known Issue #8 added |

---

| # | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| 1 | `next.config.ts` suppresses build errors | Medium | 🟡 Partial | TS half fixed (`ignoreBuildErrors: false`, ledger 102). ESLint still skipped in builds — no `eslint.config.js` exists yet; deferred past demo |
| 2 | Unused dependencies | Low | Open (deferred) | `tailwind-merge`, `class-variance-authority`, `@radix-ui/*` installed but not imported — uninstall deferred to post-demo (package-lock churn, zero demo payoff) |
| 3 | `ws` not in package.json | Low | ✅ Fixed | Declared as devDependency in `fd9ab78` |
| 4 | `openai`, `@anthropic-ai/sdk` not installed | Low | ✅ Resolved (superseded) | Both dropped — Phase 1 fork chose Groq; `groq-sdk` installed and live since `e444a21` |
| 5 | `public/` directory empty | Low | Open | No favicon or static assets |
| 6 | No `.env` file | Low | OK | Falls back to hardcoded `ws://localhost:8080` |
| 7 | No dark mode toggle | Low | OK | Defaults to dark via data-theme="dark" — toggle is future work |
| 8 | `npm run build` clobbers a live dev server | Medium | ⚠️ Footgun (unfixed, habit-tracked) | Next 15 dev and prod share `.next`; a build while `dev` runs replaces its vendor-chunks ⇒ dev serves `ENOENT .../vendor-chunks/zod.js` → dashboard 500s with a browser-side `a[d] is not a function`. Recovery: stop dev, delete `.next`, restart (done 2026-09-15, hit once during verification). Never run `build` while dev is live |

---

## Next Actions

| Priority | Action | Phase | Notes |
|---|---|---|---|
| 1 | ~~Decide Phase 1 scope~~ | Phase 1 | ✅ Resolved 2026-09-15: hybrid — LLM agents consume the broker's trusted state on the StateMesh (ledger 088); provider Groq |
| 2 | ~~Commit Phase 1/2 work~~ | Phase 1 | ✅ Committed `e444a21` (`.env.local` verified still ignored) |
| 3 | ~~Write tests~~ | Phase 4 | ✅ C6 `a5df1f6` (31) + audit-fix `3ffbb7d` (+11 = **42 green**). agentBroker allSettled/arbiter-fallback paths remain untested (need fetch mocks; low priority) |
| 4 | Manual QA pass + demo rehearsal | Phase 4 | Run plan §Verification checklist against live dev+mock before the demo (README has the 2½-min script) |
| 5 | ~~Wire DriftControls~~ | Phase 4 | ✅ Prompt 7 complete (C2–C4) — controls reach the simulator, consensus recalculates, echoes drive the UI |
| 6 | Deploy to Vercel (last) | Phase 4 | After local demo verified; needs GROQ_API_KEY project env var; mock WS can't live on serverless — demo stays local-first |
| 7 | Add ESLint flat config + enable build lint | Phase 4 | Post-demo (Known Issue #1 remainder) |
| 8 | Clean up unused dependencies | — | Post-demo (Known Issue #2) |
| 9 | Favicon + `public/` assets | Phase 4 | Known Issue #5 — cheap polish before demo |
| 10 | ⚠️ Rotate the Groq key | User | A live key string sits in `.claude/settings.local.json` allow-list curl patterns (untracked, on disk outside the `.env.local` convention). Rotate + scrub manually before sharing the repo/machine |
