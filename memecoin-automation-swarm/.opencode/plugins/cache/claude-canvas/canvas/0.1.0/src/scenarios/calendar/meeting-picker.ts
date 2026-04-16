// Meeting Picker Scenario - Select a free time slot from multiple calendars

import type {
  ScenarioDefinition,
  MeetingPickerConfig,
  MeetingPickerResult,
} from "../types";

export const meetingPickerScenario: ScenarioDefinition<
  MeetingPickerConfig,
  MeetingPickerResult
> = {
  name: "meeting-picker",
  description: "Select a free time slot when viewing multiple calendars",
  canvasKind: "calendar",
  interactionMode: "selection",
  closeOn: "selection", // Can be overridden by config
  defaultConfig: {
    calendars: [],
    slotGranularity: 30,
    minDuration: 30,
    maxDuration: 120,
    startHour: 6,
    endHour: 22,
  },
};
