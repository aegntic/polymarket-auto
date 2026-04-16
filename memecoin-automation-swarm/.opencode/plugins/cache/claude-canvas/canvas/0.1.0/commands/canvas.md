---
name: canvas
description: Spawn interactive terminal canvases for calendars, documents, and flight booking
---

# Canvas Command

Spawn and control interactive terminal displays (TUIs) in tmux split panes.

## Usage

When the user invokes `/canvas`, help them spawn the appropriate canvas type based on their needs.

## Workflow

### Step 1: Determine Canvas Type

Ask what kind of canvas the user needs:

- **Calendar** - Display events or pick meeting times
- **Document** - View or edit markdown content
- **Flight** - Compare flights and select seats

### Step 2: Gather Configuration

Based on the canvas type, collect the necessary configuration:

**Calendar:**
- Events to display (title, start/end times)
- For meeting picker: multiple calendars with busy times
- Slot granularity (15/30/60 minutes)

**Document:**
- Markdown content to display
- Document title
- Edit mode or display-only
- Optional diff highlighting

**Flight:**
- Flight options (airline, times, prices)
- Seatmap configuration
- Origin/destination airports

### Step 3: Spawn Canvas

Use the CLI to spawn the canvas:

```bash
cd ${CLAUDE_PLUGIN_ROOT}
bun run src/cli.ts spawn [type] --scenario [scenario] --config '[json]'
```

**Examples:**

```bash
# Calendar display
bun run src/cli.ts spawn calendar --config '{"events": [...]}'

# Meeting picker
bun run src/cli.ts spawn calendar --scenario meeting-picker --config '{"calendars": [...]}'

# Document editor
bun run src/cli.ts spawn document --scenario edit --config '{"content": "# Title", "title": "Doc"}'

# Flight booking
bun run src/cli.ts spawn flight --config '{"flights": [...]}'
```

### Step 4: Handle Results

Wait for user interaction and handle the result:

- **Selected**: User made a selection (time slot, text, flight+seat)
- **Cancelled**: User pressed Escape or quit
- **Error**: Something went wrong

## Requirements

- Must be running inside a tmux session
- Terminal should support mouse input for interactive scenarios

## Skills Reference

Read these skills for detailed configuration options:

- `canvas` - Overview and IPC communication
- `calendar` - Calendar events and meeting picker
- `document` - Markdown rendering and text selection
- `flight` - Flight comparison and seatmaps
