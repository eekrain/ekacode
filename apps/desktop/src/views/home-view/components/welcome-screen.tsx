import type { RecentProject } from "@/core/chat/types";

import { Button } from "@/components/ui/button";

import { cn } from "@/utils";
import { RecentProjectsList } from "./recent-project-list";

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
    <div class={cn("bg-background min-h-screen p-8", "flex flex-col", props.class)}>
      {/* Header */}
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
                    stroke="#968436"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />

                  <path
                    d="M 86.5 105 C 90 100, 110 100, 113.5 105"
                    fill="none"
                    stroke="#968436"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <path
                    d="M 84 92 C 90 85, 110 85, 116 92"
                    fill="none"
                    stroke="#968436"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <path
                    d="M 86 78 C 90 70, 110 70, 114 78"
                    fill="none"
                    stroke="#968436"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <path
                    d="M 92 65 C 95 60, 105 60, 108 65"
                    fill="none"
                    stroke="#968436"
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
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
        )}
      </header>

      {/* Main Content */}
      <main class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        {/* Left: Branding + Actions */}
        <div class="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-8 duration-500">
          <div>
            <h2 class="text-foreground mb-2 text-3xl font-semibold">Start</h2>
            <p class="text-muted-foreground text-sm">Open a project or clone from a URL</p>
          </div>

          <div class="flex flex-col gap-3">
            <Button variant="primary" size="lg" onClick={props.onOpenFolder}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Open Folder</span>
            </Button>
            <Button variant="secondary" size="lg" onClick={props.onCloneFromUrl}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
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
              <span>Clone from URL</span>
            </Button>
          </div>

          {/* Privacy Badge */}
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

        {/* Right: Recent Projects */}
        <div
          class={cn(
            "flex flex-col gap-4",
            "animate-in fade-in slide-in-from-bottom-4 delay-150 duration-500"
          )}
        >
          <div>
            <h2 class="text-foreground mb-2 text-3xl font-semibold">Recent</h2>
            <p class="text-muted-foreground text-sm">
              {props.recentProjects.length === 0
                ? "No recent projects"
                : `${props.recentProjects.length} recent ${
                    props.recentProjects.length === 1 ? "project" : "projects"
                  }`}
            </p>
          </div>

          {props.recentProjects.length === 0 ? (
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
                <p class="text-muted-foreground text-sm">Open a folder to get started</p>
              </div>
            </div>
          ) : (
            <RecentProjectsList
              projects={props.recentProjects}
              onOpen={props.onOpenProject}
              onRemove={props.onRemoveProject}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        class={cn(
          "border-border mt-12 border-t pt-6",
          "flex items-center justify-between",
          "animate-in fade-in slide-in-from-bottom-4 delay-300 duration-500"
        )}
      >
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
