/**
 * Bootstrap system for Instance context
 *
 * Automatically detects project information and VCS details
 * when Instance.provide() is called.
 */

import { detectProject } from "../workspace/project";
import { getVCSInfo } from "../workspace/vcs";
import type { InstanceContext } from "./context";

/**
 * Bootstrap project detection and VCS information
 *
 * @param context - The context to populate with project and VCS info
 */
export async function bootstrapProject(context: InstanceContext): Promise<void> {
  // Detect project information
  context.project = await detectProject(context.directory);

  // Detect VCS information
  context.vcs = await getVCSInfo(context.directory);
}
