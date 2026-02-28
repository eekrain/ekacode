import type { ArchivedWorkspace, RecentProject } from "@/core/chat/types";
import { WorkspaceDashboard } from "@/views/home-view/components/workspace-dashboard";
import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("WorkspaceDashboard", () => {
  let container: HTMLDivElement;
  let dispose: (() => void) | undefined;

  const archived: ArchivedWorkspace[] = [
    {
      id: "arch-1",
      name: "Archived",
      path: "/tmp/archived",
      archivedAt: new Date("2024-01-01T00:00:00.000Z"),
      isMerged: true,
      baseBranch: "main",
      repoPath: "/tmp/repo",
    },
  ];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    dispose?.();
    document.body.removeChild(container);
  });

  function renderDashboard(recent: RecentProject[], onOpenWorkspace = vi.fn()) {
    ({ unmount: dispose } = render(
      () => (
        <WorkspaceDashboard
          recentWorkspaces={recent}
          archivedWorkspaces={archived}
          onOpenWorkspace={onOpenWorkspace}
          onArchiveWorkspace={vi.fn()}
          onRestoreWorkspace={vi.fn()}
          onNewWorkspace={vi.fn()}
          onSearch={vi.fn()}
        />
      ),
      { container }
    ));
    return onOpenWorkspace;
  }

  it("groups workspaces by project and keeps ungrouped fallback", () => {
    renderDashboard([
      {
        id: "ws-1",
        name: "Workspace One",
        path: "/tmp/ws-1",
        lastOpened: new Date("2026-02-28T10:00:00.000Z"),
        projectId: "p-1",
        project: { id: "p-1", name: "acme/app", path: "github.com/acme/app" },
      },
      {
        id: "ws-2",
        name: "Workspace Two",
        path: "/tmp/ws-2",
        lastOpened: new Date("2026-02-28T09:00:00.000Z"),
        projectId: undefined,
      },
    ]);

    expect(container.textContent).toContain("Projects");
    expect(container.textContent).toContain("acme/app");
    expect(container.textContent).toContain("Workspace Two");
  });

  it("opens the most recently used workspace for a project card", () => {
    const onOpenWorkspace = renderDashboard([
      {
        id: "older",
        name: "Older Workspace",
        path: "/tmp/older",
        lastOpened: new Date("2026-02-28T08:00:00.000Z"),
        projectId: "p-1",
        project: { id: "p-1", name: "acme/app", path: "github.com/acme/app" },
      },
      {
        id: "newer",
        name: "Newer Workspace",
        path: "/tmp/newer",
        lastOpened: new Date("2026-02-28T10:00:00.000Z"),
        projectId: "p-1",
        project: { id: "p-1", name: "acme/app", path: "github.com/acme/app" },
      },
    ]);

    const openButton = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "Open"
    );
    openButton?.click();

    expect(onOpenWorkspace).toHaveBeenCalledTimes(1);
    expect(onOpenWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: "newer" }));
  });
});
