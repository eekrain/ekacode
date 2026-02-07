import { registerPartComponent } from "../message-part";
import { ErrorPartDisplay } from "./error-part";
import { FilePartDisplay } from "./file-part";
import { PatchPartDisplay } from "./patch-part";
import { ReasoningPartDisplay } from "./reasoning-part";
import { SnapshotPartDisplay } from "./snapshot-part";
import { StepFinishPartDisplay, StepStartPartDisplay } from "./step-part";
import { TextPartDisplay } from "./text-part";
import { ToolPartDisplay } from "./tool-part";

let registered = false;

export function registerDefaultPartComponents(): void {
  if (registered) return;

  // Basic parts (5/9 - already implemented)
  registerPartComponent("text", TextPartDisplay);
  registerPartComponent("tool", ToolPartDisplay);
  registerPartComponent("reasoning", ReasoningPartDisplay);
  registerPartComponent("file", FilePartDisplay);
  registerPartComponent("error", ErrorPartDisplay);

  // Additional parts (4/9 - newly implemented)
  registerPartComponent("snapshot", SnapshotPartDisplay);
  registerPartComponent("patch", PatchPartDisplay);
  registerPartComponent("step-start", StepStartPartDisplay);
  registerPartComponent("step-finish", StepFinishPartDisplay);

  registered = true;
}
