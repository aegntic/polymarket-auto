---
name: "OpenClaw Doctor"
description: "Diagnoses and repairs the local OpenClaw workspace at /home/ae/openclaw/. Validates schemas, policies, agent cards, memory files, Docker services, and config integrity. Use when troubleshooting OpenClaw issues, checking workspace health, validating agent registrations, or fixing config problems. Always reads live workspace state before diagnosing — never cache."
---

# OpenClaw Doctor

Diagnostic and repair skill for the **local OpenClaw workspace** at `/home/ae/openclaw/`.

> **Scope:** Local workspace only. For clawreform production checks, use the separate clawreform-doctor skill.
>
> **Relationship:** clawreform uses OpenClaw at a kernel level — they are architecturally different systems. This skill does not touch clawreform.

## Operating Principles

1. **Read live, never cache.** The workspace evolves between sessions. Always re-read files before diagnosing.
2. **Ultrathink every fix.** Before proposing changes: read ALL related files, cross-reference for consistency, consider downstream effects. If the user's approach is sub-par, say so and offer the better path.
3. **If unsure, ask.** Never guess at user intent. Prefer a 10-second clarification over a 10-minute wrong fix.
4. **Remember preferences.** Save learned corrections to Claude memory so future sessions benefit.
5. **Minimal blast radius.** Confirm before destructive actions (deleting agents, rewriting policies, resetting state).

## Quick Start

User invokes with `/openclaw-doctor` or by describing an OpenClaw problem.

Default behavior (no args): run a **full health check** and report findings.

With args: run the specific diagnostic. Examples:
- `/openclaw-doctor schemas` — validate all JSON schemas
- `/openclaw-doctor policies` — audit policy consistency
- `/openclaw-doctor agents` — validate all agent cards
- `/openclaw-doctor memory` — check memory system integrity
- `/openclaw-doctor infra` — check Docker and services
- `/openclaw-doctor fix <issue>` — attempt to repair a specific problem

---

## Workspace Architecture

```
/home/ae/openclaw/
├── .openclaw/workspace-state.json   # Bootstrap state
├── .coordination/framework.md       # Agent coordination topology
├── AGENTS.md                         # Agent behavior rules
├── SOUL.md                           # Agent personality
├── IDENTITY.md                       # Agent identity (Faxx)
├── USER.md                           # Human info (tabs)
├── MEMORY.md                         # Long-term agent memory
├── TOOLS.md                          # Credentials and infra
├── HEARTBEAT.md                      # Periodic task config
├── schemas/                          # JSON Schema definitions
│   ├── AGENT_REGISTRY_SCHEMA.json
│   ├── TASK_PACKET_SCHEMA.json
│   ├── ARTIFACT_SCHEMA.json
│   └── MESSAGE_PACKET_SCHEMA.json
├── policies/                         # Behavior constraints
│   ├── POLICY_RULES.yaml
│   ├── structural_ratchets.yaml
│   ├── import_boundaries.yaml
│   ├── WORKER_CONTRACTS.md
│   └── SCHEDULER_CRON_MAP.md
├── agents/                           # Agent card definitions
│   ├── analysis/codebase-mapper/AGENT_CARD.yaml
│   ├── development/tdd-practitioner/AGENT_CARD.yaml
│   └── security/vulnerability-scanner/AGENT_CARD.yaml
├── apps/                             # Python services (uvicorn)
│   ├── registry_api/app.py       :8001
│   ├── dispatcher/app.py         :8002
│   ├── scheduler/app.py          :8003
│   ├── evaluator/app.py          :8004
│   ├── repair/app.py             :8005
│   └── worker_runner/app.py
├── docs/                             # Documentation
│   ├── HARNESS_INTEGRATION.md
│   └── RPEQ_WORKFLOW.md
├── scripts/                          # Setup scripts
│   └── bootstrap.sh
└── infra/                            # Docker compose files
```

## Diagnostic Procedures

### 1. Full Health Check (default)

Run all sub-checks below. Report only problems — skip "everything is fine" noise.

#### 1a. File Existence

Required files that MUST exist:

```bash
REQUIRED=(
  AGENTS.md SOUL.md IDENTITY.md USER.md MEMORY.md TOOLS.md HEARTBEAT.md
  .openclaw/workspace-state.json
  schemas/AGENT_REGISTRY_SCHEMA.json schemas/TASK_PACKET_SCHEMA.json
  schemas/ARTIFACT_SCHEMA.json schemas/MESSAGE_PACKET_SCHEMA.json
  policies/POLICY_RULES.yaml policies/structural_ratchets.yaml
  policies/import_boundaries.yaml policies/WORKER_CONTRACTS.md
  policies/SCHEDULER_CRON_MAP.md
)
for f in "${REQUIRED[@]}"; do
  [ -f "/home/ae/openclaw/$f" ] && echo "OK $f" || echo "MISSING $f"
done
```

#### 1b. JSON Schema Validity

```bash
for f in /home/ae/openclaw/schemas/*.json; do
  python3 -c "import json; json.load(open('$f'))" 2>&1 && echo "VALID $f" || echo "INVALID $f"
done
```

#### 1c. YAML Policy Validity

```bash
for f in /home/ae/openclaw/policies/*.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>&1 && echo "VALID $f" || echo "INVALID $f"
done
```

#### 1d. Infrastructure

```bash
# Docker
docker ps --filter "name=openclaw" --format "{{.Names}}: {{.Status}}" 2>/dev/null || echo "No openclaw containers"
docker image inspect ghcr.io/openclaw/openclaw:latest --format "{{.RepoDigests}}" 2>/dev/null || echo "Image not pulled"

# Services
for port in 8001 8002 8003 8004 8005; do
  curl -s -o /dev/null -w "localhost:$port -> %{http_code}\n" "http://localhost:$port/" 2>/dev/null || echo "localhost:$port -> DOWN"
done

# Databases
docker exec openclaw-postgres pg_isready 2>/dev/null || echo "PostgreSQL: not reachable"
docker exec openclaw-redis redis-cli ping 2>/dev/null || echo "Redis: not reachable"
```

### 2. Schema Validation

Deep validation that schemas are internally consistent.

**Checks:**
- Every `$ref` in properties resolves to a defined definition
- `required` fields all exist in `properties`
- `enum` values are non-empty arrays
- `additionalProperties: false` is set (OpenClaw convention — strict schemas)
- All `format` values are valid JSON Schema formats

### 3. Policy Audit

Cross-reference all policy files for contradictions.

**Checks:**
- Every `applies_to` agent ID in `POLICY_RULES.yaml` has a matching `AGENT_CARD.yaml` in `agents/`
- No agent has the same tool in both `tools_allow` and `tools_deny`
- Wildcard policies (`agent.*.worker.*`) don't conflict with specific agent policies
- `structural_ratchets.yaml` severity values are `info`, `warning`, or `error`
- `import_boundaries.yaml` has no circular layer dependencies
- `SCHEDULER_CRON_MAP.md` agent names match registered agents

### 4. Agent Card Validation

Validate every `AGENT_CARD.yaml` against `AGENT_REGISTRY_SCHEMA.json` rules.

**Required fields per card:** `id`, `name`, `kind`, `project`, `owner`, `identity`, `capabilities`, `contracts`, `activation`, `health`, `addressing`

**Format rules:**
- `id`: must match `agent.[a-z0-9-]+.v[0-9]+`
- `kind`: must be `operator`, `scheduled_specialist`, `evaluator`, `repair`, or `worker`
- `activation.trigger` or `activation.mode`: must be `persistent`, `scheduled`, `event_driven`, or `on_demand`
- `activation.schedule`: if present, must be valid cron (5 fields)
- `health.success_rate`: must be 0.0–1.0
- `health.failure_streak`: must be >= 0

**Cross-reference checks:**
- Agent has a matching policy in `POLICY_RULES.yaml`
- Agent's `produces`/`consumes` align with `WORKER_CONTRACTS.md`
- If `kind: scheduled_specialist`, schedule is present and valid
- If `kind: operator`, `persistent: true` implied

### 5. Memory System Check

**Checks:**
- `SOUL.md` — not empty/stub, contains personality directives
- `IDENTITY.md` — has name, creature, vibe, emoji populated
- `USER.md` — has name, timezone, notes populated
- `MEMORY.md` — check `Last updated` date; warn if >30 days stale
- `HEARTBEAT.md` — empty or has valid task entries
- `TOOLS.md` — credentials present for active integrations
- `memory/` directory — exists, has recent daily log files
- `workspace-state.json` — valid JSON, has version and timestamp

### 6. Infrastructure Deep Check

**Services from `scripts/bootstrap.sh`:**

| Service | Port | Check |
|---------|------|-------|
| Registry API | 8001 | `GET /` returns response |
| Dispatcher | 8002 | `GET /` returns response |
| Scheduler | 8003 | `GET /` returns response |
| Evaluator | 8004 | `GET /` returns response |
| Repair | 8005 | `GET /` returns response |
| PostgreSQL | 5432 | `pg_isready` succeeds |
| Redis | 6379 | `PING` returns `PONG` |

---

## Fix Procedures

### Fix: Missing Core File

Recreate from canonical template. **Always confirm with user before writing identity files** (SOUL.md, IDENTITY.md, USER.md) — those contain personal data.

| File | Auto-recreate? | Template |
|------|---------------|----------|
| HEARTBEAT.md | Yes | Empty with comment header |
| workspace-state.json | Yes | `{"version":1,"bootstrapSeededAt":"<ISO>"}` |
| AGENTS.md | Ask first | Use existing as template |
| SOUL.md | **No** — must come from user | — |
| IDENTITY.md | **No** — must come from user | — |
| USER.md | **No** — must come from user | — |
| MEMORY.md | Ask first | Preserve existing content |
| TOOLS.md | **No** — contains credentials | — |

### Fix: Invalid JSON/YAML

Parse the error, fix syntax, rewrite. Validate after fix.

### Fix: Orphaned Agent (card exists, no policy)

1. Read the agent card
2. Determine appropriate `tools_allow`, `tools_deny`, `network_allow` based on `kind` and `capabilities`
3. Generate policy entry following existing patterns in `POLICY_RULES.yaml`
4. Present to user before writing

### Fix: Stale Memory

1. Read recent `memory/YYYY-MM-DD.md` files
2. Distill key events into `MEMORY.md`
3. Update `Last updated` timestamp

---

## Alternative Suggestions

When the user's approach is sub-par, offer the better path:

| User says | Better approach | Why |
|-----------|----------------|-----|
| "Add agent without card" | Create AGENT_CARD + policy + contract together | Agents need all three |
| "Edit policy directly" | Edit card first, then sync policy | Policy derives from card |
| "Delete agent file" | Retire in card status first | Prevents orphaned task refs |
| "Change agent kind" | Review contract + policy implications | Kind affects scheduling and tools |
| "Skip validation" | Run `openclaw check` first | Invalid schemas = silent failures |
| "Hardcode creds in TOOLS.md" | Use env vars, reference in TOOLS.md | Security risk |
| "P0 priority" | Use "PZero" | User has dyslexia — P0 reads as PO |

---

## Key Reference Data

- **Agent kinds:** operator, scheduled_specialist, evaluator, repair, worker
- **Agent statuses:** dormant, waking, active, verifying, reporting, validated, retired
- **Activation modes:** persistent, scheduled, event_driven, on_demand
- **Priority levels:** low, normal, high, critical
- **Quality gates:** A (format/lint), B (imports), C (structure), D (snapshots), E (golden), F (numerical)
- **RPEQ workflow:** Research -> Plan -> Execute -> QA
- **Canonical CLI:** `openclaw check` runs all gates
- **Coordination:** mesh topology, max 5 agents, balanced strategy
- **Priority naming:** PZero not P0 (dyslexia accommodation)
