# AGENTS.md — AI Agent Governance Rules

> This file enforces rules for all AI agents working on this project. Read AI_CONTEXT.md first for full context.

---

## Universal Instructions

1. **Authenticity**: All technical facts, citations, statistics, and API contracts must be verifiable. Unverified or hallucinated code/data is strictly prohibited. Reference official documentation for OpenAI and Anthropic APIs.

2. **Planning Governance**: Always present a complete, detailed implementation plan and wait for explicit user approval before modifying files or executing structural changes. No exceptions.

3. **Session Continuity**: Follow the Boot Sequences and Close-Out procedures defined in AI_CONTEXT.md.
   - **Full Boot** (session start): Read `AI_CONTEXT.md`, `PROJECT_ROADMAP.md`, and `SYSTEM_LEDGER.md`. Confirm understanding before proceeding.
   - **Quick Boot** (context refresh): Read `AI_CONTEXT.md` and `SYSTEM_LEDGER.md`, then resume.
   - **Close-Out** (session end): Update `PROJECT_ROADMAP.md` and `SYSTEM_LEDGER.md` with all changes.

4. **Scope Control**: Never build out of scope. Work strictly within the current 🔴 **ACTIVE** phase declared in `PROJECT_ROADMAP.md`. If a requested change falls outside the active phase, inform the user and suggest it for the appropriate future phase.

---

## Code Quality Rules

- No `any` types — always provide explicit TypeScript types
- No hardcoded secrets — use environment variables
- No `console.log` in production code — use structured logging
- All API inputs validated with Zod before processing
- All async operations wrapped in error handling
- Follow the adapter pattern for AI provider integrations

---

## File Operations

- Never modify `AI_CONTEXT.md` sections related to architecture without user approval
- Always update `SYSTEM_LEDGER.md` when creating or modifying files
- Always update `PROJECT_ROADMAP.md` task status when completing work
- Keep `PROJECT_ROADMAP.md` phases accurate — never mark a task complete if it hasn't been verified

---

## Reference Files

- `AI_CONTEXT.md` — Architecture, rules, design tokens, session management
- `PROJECT_ROADMAP.md` — Active phase, tasks, milestones
- `SYSTEM_LEDGER.md` — File state, known issues, next actions
