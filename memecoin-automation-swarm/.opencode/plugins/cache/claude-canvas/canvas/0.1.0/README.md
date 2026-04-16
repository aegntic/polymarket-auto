# Canvas Plugin

Interactive terminal TUI components for Claude Code.

## Overview

Canvas provides spawnable terminal displays (calendars, documents, flight booking) with real-time IPC communication. Claude can spawn these TUIs in tmux split panes and receive user selections.

## Canvas Types

| Type | Description |
|------|-------------|
| `calendar` | Display events, pick meeting times |
| `document` | View/edit markdown documents |
| `flight` | Compare flights and select seats |

## Installation

```bash
# Add as Claude Code plugin
claude --plugin-dir /path/to/claude-canvas/canvas

# Or via marketplace
/plugin marketplace add djsiegel/claude-canvas
/plugin install claude-canvas@canvas
```

## Usage

```bash
# Show calendar in current terminal
bun run src/cli.ts show calendar

# Spawn meeting picker in tmux split
bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{"calendars": [...]}'

# Spawn document editor
bun run src/cli.ts spawn document --scenario edit --config '{"content": "# Hello"}'
```

## Commands

- `/canvas` - Interactive canvas spawning

## Skills

- `canvas` - Main skill with overview and IPC details
- `calendar` - Calendar display and meeting picker
- `document` - Markdown rendering and text selection
- `flight` - Flight comparison and seatmaps

## Requirements

- **tmux** - Canvas spawning requires a tmux session
- **Bun** - Runtime for CLI commands
- **Terminal with mouse support** - For interactive scenarios

## License

MIT
