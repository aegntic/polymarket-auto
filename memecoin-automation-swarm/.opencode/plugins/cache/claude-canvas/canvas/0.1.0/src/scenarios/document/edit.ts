// Document Edit Scenario - Interactive document view with text selection

import type { ScenarioDefinition } from "../types";
import type { DocumentConfig, DocumentSelection } from "../../canvases/document/types";

export const documentEditScenario: ScenarioDefinition<DocumentConfig, DocumentSelection> = {
  name: "edit",
  description: "Interactive document view with text selection and diff highlighting",
  canvasKind: "document",
  interactionMode: "selection",
  closeOn: "escape",
  defaultConfig: {
    content: "",
    readOnly: false,
  },
};
