# Canvas Plugin Development

Use Bun for all development:

- `bun run src/cli.ts` - Run CLI
- `bun test` - Run tests
- `bun install` - Install dependencies

## Structure

```
canvas/
├── src/           # TypeScript source code
│   ├── cli.ts     # CLI entry point
│   ├── canvases/  # Canvas components (React/Ink)
│   ├── scenarios/ # Scenario definitions
│   ├── ipc/       # IPC server/client
│   └── api/       # High-level API
├── skills/        # Skill documentation
├── commands/      # User commands
└── package.json   # Plugin dependencies
```

## Adding a New Canvas Type

1. Create component in `src/canvases/`
2. Register scenarios in `src/scenarios/`
3. Add skill in `skills/[name]/SKILL.md`
4. Update main canvas skill

## IPC Protocol

Canvases communicate via Unix domain sockets:

```typescript
// Canvas → Controller
{ type: "ready", scenario }
{ type: "selected", data }
{ type: "cancelled" }

// Controller → Canvas
{ type: "update", config }
{ type: "close" }
```
