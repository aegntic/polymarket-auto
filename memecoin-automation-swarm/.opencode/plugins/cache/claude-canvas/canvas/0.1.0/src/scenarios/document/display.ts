// Document Display Scenario - Read-only document view

import type { ScenarioDefinition } from "../types";
import type { DocumentConfig } from "../../canvases/document/types";

export const documentDisplayScenario: ScenarioDefinition<DocumentConfig, void> = {
  name: "display",
  description: "Read-only document view with markdown rendering",
  canvasKind: "document",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    content: "",
    readOnly: true,
  },
};
