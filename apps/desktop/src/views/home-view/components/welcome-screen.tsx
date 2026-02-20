import type { RecentProject } from "@/core/chat/types";

import { Button } from "@/components/ui/button";

import { cn } from "@/utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { For, Show } from "solid-js";
import { WorkspaceLauncherCard } from "./workspace-launcher-card";

dayjs.extend(relativeTime);

interface RecentProjectCardProps {
  project: RecentProject;
  onOpen: (project: RecentProject) => void;
  onRemove?: (project: RecentProject) => void;
  class?: string;
}

function RecentProjectCard(props: RecentProjectCardProps) {
  const isActive = () => {
    const hoursSinceLastOpen = dayjs().diff(dayjs(props.project.lastOpened), "hour");
    return hoursSinceLastOpen < 24;
  };

  return (
    <div
      class={cn(
        "border-border bg-card mb-4 overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md",
        props.class
      )}
      onClick={() => props.onOpen(props.project)}
    >
      <div class="bg-muted/30 border-border flex items-center justify-between border-b px-4 py-3">
        <div class="text-foreground flex items-center gap-2 font-semibold">
          <div class="h-5 w-5 rounded-full bg-slate-800 dark:bg-slate-200" />
          <span>{props.project.name}</span>
        </div>
      </div>

      <div class="hover:bg-accent/30 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors">
        <div
          class={cn("h-2 w-2 rounded-full", isActive() ? "bg-green-500" : "bg-muted-foreground")}
        />
        <span class="text-foreground flex-1 text-sm font-medium">{props.project.name}</span>
        <span class="text-muted-foreground text-xs">
          {dayjs(props.project.lastOpened).fromNow()}
        </span>
      </div>

      {props.onRemove && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={e => {
            e.stopPropagation();
            props.onRemove?.(props.project);
          }}
          class={cn(
            "absolute bottom-3 right-3 opacity-0 transition-opacity",
            "group-hover:opacity-100",
            "text-muted-foreground hover:text-destructive"
          )}
          aria-label="Remove project"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
          </svg>
        </Button>
      )}
    </div>
  );
}

interface RecentProjectsListProps {
  projects: RecentProject[];
  onOpen: (project: RecentProject) => void;
  onRemove?: (project: RecentProject) => void;
  class?: string;
}

export function RecentProjectsList(props: RecentProjectsListProps) {
  return (
    <div class={cn("flex flex-col gap-2", props.class)}>
      <For each={props.projects}>
        {project => (
          <RecentProjectCard project={project} onOpen={props.onOpen} onRemove={props.onRemove} />
        )}
      </For>
    </div>
  );
}

interface WelcomeScreenProps {
  recentProjects: RecentProject[];
  onOpenFolder: () => void;
  onCloneFromUrl: () => void;
  onOpenProject: (project: RecentProject) => void;
  onRemoveProject?: (project: RecentProject) => void;
  onOpenSettings?: () => void;
  onOpenDocs?: () => void;
  class?: string;
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  return (
    <div
      class={cn(
        "bg-background text-foreground min-h-screen p-8 font-sans",
        "flex flex-col",
        props.class
      )}
    >
      <header class="mb-12 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
              <defs>
                <g id="petal">
                  <path
                    d="M100 135 
                 C 85 125, 80 90, 100 45 
                 C 120 90, 115 125, 100 135 Z"
                    fill="none"
                    stroke="var(--primary-foreground)"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />

                  <path
                    d="M 86.5 105 C 90 100, 110 100, 113.5 105"
                    fill="none"
                    stroke="var(--primary-foreground)"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <path
                    d="M 84 92 C 90 85, 110 85, 116 92"
                    fill="none"
                    stroke="var(--primary-foreground)"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <path
                    d="M 86 78 C 90 70, 110 70, 114 78"
                    fill="none"
                    stroke="var(--primary-foreground)"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <path
                    d="M 92 65 C 95 60, 105 60, 108 65"
                    fill="none"
                    stroke="var(--primary-foreground)"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                </g>
              </defs>

              <use href="#petal" transform="rotate(0, 100, 100)" />
              <use href="#petal" transform="rotate(45, 100, 100)" />
              <use href="#petal" transform="rotate(90, 100, 100)" />
              <use href="#petal" transform="rotate(135, 100, 100)" />
              <use href="#petal" transform="rotate(180, 100, 100)" />
              <use href="#petal" transform="rotate(225, 100, 100)" />
              <use href="#petal" transform="rotate(270, 100, 100)" />
              <use href="#petal" transform="rotate(315, 100, 100)" />
            </svg>
          </div>
          <div>
            <h1 class="text-foreground text-xl font-semibold">Sakti Agentic Coder</h1>
            <p class="text-muted-foreground text-xs">Privacy-focused local AI coding agent</p>
          </div>
        </div>
        {props.onOpenSettings && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={props.onOpenSettings}
            aria-label="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22-.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1-2 0l.43-.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2-2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1-1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1-1-1.74l-.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1 1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
        )}
      </header>

      <main class="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-12">
        <div class="flex flex-col justify-center lg:col-span-7">
          <div class="mb-8">
            <h1 class="text-foreground mb-2 text-3xl font-bold tracking-tight">
              Select a workspace
            </h1>
            <p class="text-muted-foreground">
              Open a local git worktree or clone a remote repository to start coding.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <WorkspaceLauncherCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
                </svg>
              }
              iconBgColor="bg-primary/10"
              iconColor="text-primary"
              hoverIconBgColor="bg-primary"
              hoverIconColor="text-primary-foreground"
              title="Open Local Repo"
              description="Target an existing folder or Git worktree on your device."
              onClick={props.onOpenFolder}
            />

            <WorkspaceLauncherCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              }
              iconBgColor="bg-secondary/10"
              iconColor="text-secondary-foreground"
              hoverIconBgColor="bg-secondary"
              hoverIconColor="text-secondary-foreground"
              title="Clone Remote"
              description="Paste a repository URL (GitHub, GitLab) to download and start."
              onClick={props.onCloneFromUrl}
            />
          </div>

          <div class="bg-muted/50 border-border mt-auto flex items-center gap-2 rounded-lg border px-4 py-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-green-600 dark:text-green-400"
            >
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            </svg>
            <span class="text-muted-foreground text-sm">All data stays on your device</span>
          </div>
        </div>

        <div class="border-border border-l pl-8 lg:col-span-5">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-foreground text-xs font-bold uppercase tracking-widest">
              Recent Activity
            </h2>
            <button
              class="text-muted-foreground hover:text-primary focus-visible:outline-none"
              aria-label="Search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          </div>

          <Show
            when={props.recentProjects.length === 0}
            fallback={
              <div class="flex flex-col gap-2">
                <For each={props.recentProjects}>
                  {project => (
                    <RecentProjectCard
                      project={project}
                      onOpen={props.onOpenProject}
                      onRemove={props.onRemoveProject}
                    />
                  )}
                </For>
              </div>
            }
          >
            <div class="min-h-50 flex flex-1 items-center justify-center">
              <div class="text-center">
                <div class="bg-muted/50 mb-3 inline-flex rounded-full p-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-muted-foreground"
                  >
                    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
                <p class="text-muted-foreground text-sm">No recent projects</p>
              </div>
            </div>
          </Show>
        </div>
      </main>

      <footer class={cn("border-border mt-12 border-t pt-6", "flex items-center justify-between")}>
        <div class="flex items-center gap-4">
          {props.onOpenDocs && (
            <button
              onClick={props.onOpenDocs}
              class={cn(
                "text-muted-foreground hover:text-foreground text-sm",
                "transition-colors duration-150",
                "focus-visible:underline focus-visible:outline-none"
              )}
            >
              Documentation
            </button>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            class={cn(
              "text-muted-foreground hover:text-foreground text-sm",
              "transition-colors duration-150",
              "focus-visible:underline focus-visible:outline-none"
            )}
          >
            GitHub
          </a>
        </div>
        <p class="text-muted-foreground text-xs">v{"0.1.0"}</p>
      </footer>
    </div>
  );
}
