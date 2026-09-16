# AI_CONTEXT.md — The Constitution

> This file is the single source of truth for the Multi-Modal Consensus Broker project. All AI agents must read and understand this file before making any changes.

---

## Project Identity

| Field | Value |
|---|---|
| **Name** | Multi-Modal Consensus Broker |
| **Type** | AI Ensemble System (sensor + LLM consensus) |
| **Scope** | Real-time mission-control dashboard where heterogeneous sensors reach numeric consensus through a broker, and LLM agents consume the resulting trusted state and reach decision-level consensus |
| **Core Purpose** | Eliminate single-source bias at every layer of a robot's perception-to-action loop: multiple sensors must agree before a value becomes trusted, and multiple AI agents must concur (with arbitration) before it becomes a decision |

### What It Does
The system is a pipeline of two consensus stages over one live data path:
1. **Sensors** (camera-class / LiDAR-class / IMU / thermal / gyro) stream telemetry at 1 Hz over WebSocket.
2. The **Consensus Broker** arbitrates their readings — variance thresholds, outlier exclusion, agreement ratio — and publishes a **trusted state** or refuses (FAILED ⇒ no trusted value is released).
3. **LLM agents** (Navigator, Planner, Safety Monitor on `openai/gpt-oss-20b` via Groq) subscribe to the trusted state and each decide PROCEED / CAUTION / ABSTAIN with evidence-linked rationales; an **arbiter** pass synthesizes the meta-consensus.
4. The **action gate** (risk-engine) is the safety boundary the agents' decisions inform; a refusal-to-decide (UNKNOWN) at either layer halts physical action.
5. The **StateMesh** visualization renders the whole pipeline live: feed edges stream packets, excluded sensors mark red, the trusted-state box refuses stale numbers, and agent nodes carry both wire-bus status (WS) and LLM decisions (REST).

---

## Tech Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | **Next.js** | 15.x | Full-stack React framework with API routes, server components, and edge runtime support |
| Language | **TypeScript** | 5.x | Type safety across frontend and backend; prevents runtime errors in multi-provider integrations |
| UI Library | **React** | 19.x | Component-based UI with concurrent features |
| Styling | **Tailwind CSS** | 4.x | Utility-first CSS with built-in dark mode, responsive design, and design token support |
| Validation | **Zod** | 4.x | Runtime schema validation for WS frames, API inputs, and provider responses |
| AI Provider SDK | **groq-sdk** | 1.x | Agent bus + arbiter (openai/gpt-oss-20b reasoning models on Groq) |
| AI Provider SDK | **@anthropic-ai/sdk** | — | Reserved adapter slot (Claude) — not wired; see Model & Tool Strategy |
| Package Manager | **npm** | — | Standard Node.js package management |
| Runtime | **Node.js** | >=20 | LTS version required for Next.js 15 and modern ESM features |

---

## Architecture

### Directory Structure (as built — Prompt 6 / agent layer)
```
multi-modal-consensus-broker/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   └── agents/
│   │   │       └── decide/route.ts   # POST /api/agents/decide — reasoning layer
│   │   ├── dashboard/page.tsx  # Mission-control dashboard shell
│   │   ├── layout.tsx          # Root layout (data-theme="dark")
│   │   └── globals.css         # Tailwind 4 + design tokens + pipeline animations
│   ├── components/
│   │   ├── ui/                 # Card, Badge, Gauge, LiveIndicator, RiskBar
│   │   ├── layout/             # DashboardLayout, TopBar, Sidebar
│   │   └── dashboard/          # Panels: StateMesh, AgentConsensusPanel,
│   │                           # ConsensusStatusBar, SensorGrid, RiskGauge,
│   │                           # ActionGate, OutlierList, DisagreementChart,
│   │                           # ActivityFeed, TrustedStatePanel, DriftControls,
│   │                           # ConnectionStatus, PhysicalActionPanel, ConsensusPanel, SensorCard
│   ├── hooks/                  # useWebSocket, useTelemetry (19 selectors),
│   │                           # useAgentBusRounds (reasoning-loop client engine)
│   ├── lib/
│   │   ├── ai/                 # Provider adapters (pure logic, no UI imports)
│   │   │   ├── types.ts        # ProviderAdapter interface, AgentRole
│   │   │   ├── groq.ts         # Groq adapter (decide + arbitrate, json_schema)
│   │   │   └── errors.ts       # Structured provider-error mapping
│   │   ├── consensus/          # Consensus logic
│   │   │   ├── status.ts       # Sensor-side verdict derivation (R1–R4)
│   │   │   └── agentBroker.ts  # LLM-side fan-out + meta-consensus orchestration
│   │   ├── store/telemetryStore.ts  # Zustand — all live wire state + agentRound
│   │   └── ws/                 # client.ts (reconnect), validate.ts (Zod contract)
│   └── types/telemetry.ts      # All domain types incl. AgentState + reasoning-layer shapes
├── scripts/mock-ws-server.js   # 6 sensors + agent bus, 13 inbound types + control, 36 s scenario cycle
├── public/                     # Static assets
├── .env.example / .env.local   # NEXT_PUBLIC_WS_URL, GROQ_API_KEY
├── AI_CONTEXT.md · PROJECT_ROADMAP.md · SYSTEM_LEDGER.md · AGENTS.md
```

### Design Patterns
- **Adapter Pattern**: Each AI provider is wrapped in a standardized adapter interface
- **Strategy Pattern**: Consensus algorithms are interchangeable (scoring, weighting)
- **Middleware Pattern**: API routes use Next.js middleware for auth/rate limiting
- **Event-Driven**: Provider responses are collected asynchronously via `Promise.allSettled`

### File Boundaries
- `lib/ai/` — Never import UI components; pure business logic only
- `app/api/` — Never import client-side React components
- `components/` — Never import provider SDKs directly; use `lib/` adapters
- `types/` — Global types only; no implementation logic

---

## Design Tokens

> **Implementation authority:** `src/app/globals.css` (Tailwind 4, CSS-first, `--color-*` prefix, `data-theme="dark"` on `<html>` as default). The tables below are the original design intent; where they disagree with globals.css, the CSS file wins and components reference it via `text-[var(--color-…)]`.

### Colors (Light Mode)
| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#ffffff` | Page background |
| `--bg-secondary` | `#f8fafc` | Card/panel backgrounds |
| `--bg-tertiary` | `#f1f5f9` | Subtle backgrounds |
| `--text-primary` | `#0f172a` | Headings, primary text |
| `--text-secondary` | `#475569` | Body text, descriptions |
| `--text-muted` | `#94a3b8` | Placeholders, hints |
| `--accent-primary` | `#3b82f6` | Buttons, links, active states |
| `--accent-success` | `#22c55e` | Success states, confirmations |
| `--accent-warning` | `#f59e0b` | Warnings, caution states |
| `--accent-error` | `#ef4444` | Errors, destructive actions |
| `--border-default` | `#e2e8f0` | Borders, dividers |

### Colors (Dark Mode)
| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#0f172a` | Page background |
| `--bg-secondary` | `#1e293b` | Card/panel backgrounds |
| `--bg-tertiary` | `#334155` | Subtle backgrounds |
| `--text-primary` | `#f8fafc` | Headings, primary text |
| `--text-secondary` | `#cbd5e1` | Body text, descriptions |
| `--text-muted` | `#64748b` | Placeholders, hints |
| `--accent-primary` | `#60a5fa` | Buttons, links, active states |
| `--accent-success` | `#4ade80` | Success states |
| `--accent-warning` | `#fbbf24` | Warnings |
| `--accent-error` | `#f87171` | Errors |
| `--border-default` | `#334155` | Borders, dividers |

### Typography
| Token | Font | Weight | Size |
|---|---|---|---|
| `--font-heading` | Geist Sans | 600 (semibold) | 1.5rem – 2.25rem |
| `--font-body` | Geist Sans | 400 (regular) | 0.875rem – 1rem |
| `--font-mono` | Geist Mono | 400 (regular) | 0.875rem |

### Spacing Scale
| Token | Value | Usage |
|---|---|---|
| `--space-xs` | `0.25rem` (4px) | Tight inner padding |
| `--space-sm` | `0.5rem` (8px) | Small gaps |
| `--space-md` | `1rem` (16px) | Standard padding |
| `--space-lg` | `1.5rem` (24px) | Section spacing |
| `--space-xl` | `2rem` (32px) | Page section gaps |
| `--space-2xl` | `3rem` (48px) | Major section breaks |

### Border Radius
| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `0.375rem` | Buttons, inputs |
| `--radius-md` | `0.5rem` | Cards, panels |
| `--radius-lg` | `0.75rem` | Modals, dropdowns |
| `--radius-full` | `9999px` | Avatars, badges |

---

## Strict Rules

### NEVER (Forbidden)
- Use `any` type — always provide explicit TypeScript types
- Hardcode API keys or secrets — always use environment variables
- Use `console.log` in production code — use structured logging
- Skip error handling on async operations — always use try/catch or `.catch()`
- Import from `lib/ai/` inside `components/` — go through API routes
- Use `require()` — use ES module `import` syntax
- Skip input validation — always validate with Zod before processing
- Mock AI provider responses in production code — always call real providers
- Commit `.env.local` or any file containing secrets
- Use `eslint-disable` or `@ts-ignore` to bypass quality checks
- Create files outside the established directory structure without updating this document

### ALWAYS (Required)
- Define explicit TypeScript interfaces for all data structures
- Validate all API inputs with Zod schemas before processing
- Handle errors with structured error responses (status code + message + details)
- Use `Promise.allSettled` for parallel provider calls (never let one provider crash the batch)
- Log all provider calls with timestamps and response times for observability
- Return source attribution with every consensus result (which model said what)
- Use environment variables for all configuration
- Follow the adapter pattern for AI provider integrations
- Write self-documenting code with descriptive function and variable names
- Run type checking before committing (`npm run typecheck`)

---

## Model & Tool Strategy

### Provider Configuration
| Provider | Model | Use Case | Surface |
|---|---|---|---|
| Groq | openai/gpt-oss-20b | Three decision agents (Navigator / Planner / Safety Monitor) + the arbiter, each a schema-constrained `json_schema` completion | `lib/ai/groq.ts` → `/api/agents/decide` |
| Anthropic | (reserved) | Adapter slot for a cross-vendor agent; `ProviderAdapter` interface is the seam — none wired yet | — |

### Fallback Chain
```
Agent round (12 s cadence, driven by useAgentBusRounds)
  ├─ Broker FAILED? → client skips the call entirely (no trusted state ⇒ no reasoning, zero tokens)
  ├─ Each agent runs in parallel via Promise.allSettled — one provider failure becomes a
  │   visible ABSTAIN-with-error ("NO-DECISION"), never a crash and never counted as agreement
  ├─ Transport down? → loop pauses; last round ages to STALE on the panel, mesh freezes
  └─ Arbiter failure → rule-based tally fallback (concurrence/dissent still truthful)
```

### Consensus Strategy
1. **Sensor side** (broker → trusted state): variance thresholds + outlier exclusion + agreement ratio, verdict rules R1–R4 in `lib/consensus/status.ts`. Refusal is a first-class outcome (UNKNOWN, never a stale value).
2. **Parallel dispatch**: the snapshot fans out to all agent roles simultaneously via `Promise.allSettled` (never let one provider crash the batch).
3. **Schema-constrained reasoning**: each agent returns a validated `{decision, rationale, confidence}` — attribution is per-role and per-latency.
4. **Arbitration**: the arbiter weighs rationales (a well-evidenced dissent can outweigh a shallow majority) and names dissents; concurrence/dissent counts are computed from the real decisions, not invented by the model.
5. **Attribution**: every decision carries its agentId, roleName, bus-status, latency, and any provider error through to the UI.

### Tool Execution Boundaries
- AI providers are called **only** through `lib/ai/` adapter functions
- API routes **never** call provider SDKs directly — always through adapters
- Frontend **never** calls provider SDKs directly — always through API routes

---

## i18n & Localization

| Property | Value |
|---|---|
| **Primary Language** | English (en-US) |
| **Character Script** | Latin, with full UTF-8 support |
| **Text Direction** | LTR (Left-to-Right) |
| **Future Support** | Architecture ready for i18n via `next-intl` or similar library |

---

## Global Authenticity Rule

1. All technical claims must be **verifiable** against official documentation
2. All API references must cite the **official provider docs** (OpenAI, Anthropic)
3. No **hallucinated APIs**, methods, or SDK features — verify before implementing
4. All consensus results must include **source attribution** (which model produced which response)
5. No fabricated statistics, benchmarks, or performance claims
6. Environment variables must be documented in `.env.example` with clear descriptions

---

## Session Management

### Mandatory Planning Governance

> **STRICT APPROVAL POLICY**: NEVER make direct file edits, write code, or execute mutating commands without presenting a complete, detailed implementation plan and receiving explicit user approval first.

This applies to:
- Creating new files
- Modifying existing files
- Installing dependencies
- Running build/deploy commands
- Any structural changes to the project

### Session Boot Sequences

#### Full Boot (Session Start)
When starting a new session, the AI agent MUST execute:
```
Read AI_CONTEXT.md, PROJECT_ROADMAP.md, and SYSTEM_LEDGER.md.
Confirm you understand the architecture, strict rules, and active
phase before we begin working.
```

#### Quick Boot (Context Refresh)
When resuming work mid-session or after context loss:
```
Read AI_CONTEXT.md and SYSTEM_LEDGER.md, then resume work from
where we left off.
```

### Session Close-Out Procedure

Before ending any session, the AI agent MUST execute:
```
Update PROJECT_ROADMAP.md and SYSTEM_LEDGER.md to reflect all
completed tasks, new files created, and updated system metrics before
wrapping up.
```
