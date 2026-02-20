/**
 * Workspace module
 */

export { WorkspaceInstance } from "./instance";
export { detectProject, findProjectRootFromPath } from "./project";
export {
  clone,
  createWorktree,
  getVCSInfo,
  getWorkspacesDir,
  listLocalBranches,
  listRemoteBranches,
  worktreeExists,
} from "./vcs";
