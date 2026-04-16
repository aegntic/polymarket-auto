// Display Scenario - View-only calendar display (default behavior)

import type { ScenarioDefinition, BaseCalendarConfig } from "../types";

export const displayScenario: ScenarioDefinition<BaseCalendarConfig, void> = {
  name: "display",
  description: "View-only calendar display",
  canvasKind: "calendar",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    startHour: 6,
    endHour: 22,
  },
};
