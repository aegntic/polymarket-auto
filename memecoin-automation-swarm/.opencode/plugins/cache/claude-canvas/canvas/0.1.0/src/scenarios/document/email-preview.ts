// Email Preview Scenario - Display email drafts for review

import type { ScenarioDefinition } from "../types";
import type { EmailConfig, DocumentSelection } from "../../canvases/document/types";

export const emailPreviewScenario: ScenarioDefinition<EmailConfig, DocumentSelection> = {
  name: "email-preview",
  description: "Preview email drafts with formatted headers and body",
  canvasKind: "document",
  interactionMode: "selection",
  closeOn: "escape",
  defaultConfig: {
    content: "",
    from: "",
    to: [],
    subject: "",
    readOnly: false,
  },
};
