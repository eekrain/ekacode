import type { RecentProject } from "@/core/chat/types";

import { Button } from "@/components/ui/button";

import { cn } from "@/utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Folder, Globe, Leaf, Search, Settings, X } from "lucide-solid";
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
          <X xmlns="http://www.w3.org/2000/svg" width={14} height={14} />
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
            <Settings width={20} height={20} />
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
              icon={<Folder width={24} height={24} />}
              iconBgColor="bg-primary/10"
              iconColor="text-primary"
              hoverIconBgColor="bg-primary"
              hoverIconColor="text-primary-foreground"
              title="Open Local Repo"
              description="Target an existing folder or Git worktree on your device."
              onClick={props.onOpenFolder}
            />

            <WorkspaceLauncherCard
              icon={<Globe width={24} height={24} />}
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
            <Leaf
              xmlns="http://www.w3.org/2000/svg"
              width={16}
              height={16}
              class="text-green-600 dark:text-green-400"
            />
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
              <Search width={16} height={16} />
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
                  <Folder width={24} height={24} class="text-muted-foreground" />
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
