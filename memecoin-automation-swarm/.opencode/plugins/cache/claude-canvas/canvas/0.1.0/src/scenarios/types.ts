// Scenario System Types

export type InteractionMode = "view-only" | "selection" | "multi-select";
export type CloseOn = "selection" | "escape" | "command" | "never";

export interface ScenarioDefinition<
  TConfig = unknown,
  TResult = unknown
> {
  name: string;
  description: string;
  canvasKind: string;
  interactionMode: InteractionMode;
  closeOn: CloseOn;
  autoCloseDelay?: number; // ms after selection before auto-close
  defaultConfig: Partial<TConfig>;
}

// Calendar-specific event type
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO datetime
  endTime: string;
  color?: string;
  allDay?: boolean;
}

// Calendar with named owner for multi-calendar scenarios
export interface NamedCalendar {
  name: string;
  color: string;
  events: CalendarEvent[];
}

// Base calendar config (used by display scenario)
export interface BaseCalendarConfig {
  title?: string;
  events?: CalendarEvent[];
  startHour?: number;
  endHour?: number;
}

// Meeting picker specific config
export interface MeetingPickerConfig extends BaseCalendarConfig {
  calendars: NamedCalendar[];
  slotGranularity: 15 | 30 | 60; // minutes
  minDuration: number; // minutes
  maxDuration: number; // minutes
}

// Meeting picker result
export interface MeetingPickerResult {
  startTime: string; // ISO datetime
  endTime: string;
  duration: number; // minutes
}

// Union type for all calendar configs
export type CalendarScenarioConfig = BaseCalendarConfig | MeetingPickerConfig;

// Type guard for meeting picker config
export function isMeetingPickerConfig(
  config: CalendarScenarioConfig
): config is MeetingPickerConfig {
  return "calendars" in config && Array.isArray(config.calendars);
}

// ============================================
// Document Canvas Types
// ============================================

// Document diff marker for highlighting changes
export interface DocumentDiff {
  startOffset: number;       // Character offset in content
  endOffset: number;         // End character offset
  type: "add" | "delete";    // Type of change
}

// Document canvas configuration (from Claude)
export interface DocumentConfig {
  content: string;           // Markdown content
  title?: string;            // Optional document title
  diffs?: DocumentDiff[];    // Optional diff markers for highlighting
  readOnly?: boolean;        // Disable selection (default false)
}

// Document selection result (sent to Claude via IPC)
export interface DocumentSelection {
  selectedText: string;      // The selected text content
  startOffset: number;       // Start character offset in content
  endOffset: number;         // End character offset
  startLine: number;         // Line number (1-based)
  endLine: number;           // End line number
  startColumn: number;       // Column in start line
  endColumn: number;         // Column in end line
}
