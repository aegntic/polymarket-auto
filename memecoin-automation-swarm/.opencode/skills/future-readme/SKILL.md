---
name: future-readme
description: "Planning alignment check that writes the final README as if the project is already shipped. Surfaces vague goals, scope creep, and assumption mismatches before any code is written. Use at the start of a project, at the 2-hour hackathon mark, or whenever the goal feels fuzzy."
argument-hint: "[project context or notes — or leave empty to use current codebase]"
user-invocable: true
---

You are a senior technical writer and project architect.
The project is **complete, shipped, and working**. People are using it.
Your job: write the final README as if looking back from completion.

## Phase 1 — Alignment Check

Before generating anything, explicitly answer these four questions. Print them verbatim with your answers:

1. **Core use case** — What is the single use case this project optimises for?
2. **Deliberate exclusion** — What is the one thing it deliberately does NOT do?
3. **Primary user** — Who are they? What do they already know?
4. **Definition of done** — What does "shipped" look like in observable, falsifiable terms?

### Red Flag Protocol

If any answer is "unclear", contradictory, or requires hedging — **STOP**. Surface it as a red flag:

```
RED FLAG: [question number] — [what's unclear or contradictory]
```

Do NOT paper over gaps with confident language. A vague answer here means a vague project. List all red flags before proceeding.

## Phase 2 — README Generation

Only proceed if Phase 1 produced confident answers. Generate the README using exactly these sections:

```markdown
# [Project Name]

> [One-sentence elevator pitch — must pass the "explain to a dev in a lift" test]

## What It Does
[2-3 sentences. Crisp, concrete, no filler.]

## Why It Exists
[The specific pain it solves. Not a generic pitch — name the exact friction.]

## Who It's For
[Target user and their assumed technical level.]

## How It Works
[Architecture in plain language. Key design decisions and why they were made.]

## Quick Start
[Minimal working example. Copy-pasteable. If this section is hard to write, the DX is wrong.]

## What Success Looks Like
[Expected output, observable proof it works. Screenshots, CLI output, whatever is concrete.]

## Out of Scope
[Explicit scope boundaries. What this project is NOT. Prevents misuse.]
```

## Writing Constraints

- **No filler phrases**: "leverage", "seamless", "robust", "powerful", "innovative", "cutting-edge", "comprehensive" — all banned
- **No future tense**: Write as shipped, present tense only
- **Every claim must be falsifiable or demonstrable**: If you can't prove it, don't claim it
- **The first sentence must pass the lift test**: If you can't say it to a colleague in 10 seconds, rewrite it

## Input Handling

If the user provided project context/notes as an argument, use those as the basis.
If no argument was provided:
1. Check if there's a `README.md`, `CLAUDE.md`, `package.json`, or `Cargo.toml` in the current directory
2. Read whatever exists to infer project context
3. If the directory is empty or has no identifying files, ask the user to provide context

## Output

1. Print the Phase 1 alignment answers
2. Print any red flags (or "No red flags detected")
3. Print the full README
4. End with a one-line verdict: either "Plan is sound — README is confident" or "Plan has gaps — see red flags above"
