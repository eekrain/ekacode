/**
 * RunCard Component (Planning Mode)
 *
 * Aggregated view for planning sessions showing:
 * - Header with title, status chip, and elapsed time
 * - Files edited section
 * - Progress groups with collapsible items
 */

import type {
  AgentEvent,
  ChatUIMessage,
  RunCardData,
  RunFileData,
  RunGroupData,
} from "@/core/chat/types/ui-message";
import { For, Show, createMemo, type Component } from "solid-js";
import { ThoughtIndicator } from "../activity-feed/thought-indicator";
import { FileRow } from "./file-row";
import { ProgressGroup } from "./progress-group";
import { StatusChip } from "./status-chip";

export interface RunCardProps {
  message: ChatUIMessage;
}

/**
 * Extract RunCardData from message parts
 * Note: Some streams prefix twice; accept both "data-run" and "data-data-run".
 */
function extractRunCardData(message: ChatUIMessage): RunCardData | null {
  for (const part of message.parts) {
    const partType = (part as { type?: string }).type;
    if (partType === "data-run" || partType === "data-data-run") {
      return (part as unknown as { type: string; data: RunCardData }).data;
    }
  }
  return null;
}

/**
 * Extract all files from message parts
 */
function extractFiles(message: ChatUIMessage): RunFileData[] {
  const files: RunFileData[] = [];
  for (const part of message.parts) {
    const partType = (part as { type?: string }).type;
    if (partType === "data-run-file" || partType === "data-data-run-file") {
      files.push((part as unknown as { type: string; data: RunFileData }).data);
    }
  }
  return files;
}

/**
 * Extract all groups from message parts
 */
function extractGroups(message: ChatUIMessage): RunGroupData[] {
  const groups: RunGroupData[] = [];
  for (const part of message.parts) {
    const partType = (part as { type?: string }).type;
    if (partType === "data-run-group" || partType === "data-data-run-group") {
      groups.push((part as unknown as { type: string; data: RunGroupData }).data);
    }
  }
  return groups.sort((a, b) => a.index - b.index);
}

/**
 * Extract all events from message parts
 */
function extractEvents(message: ChatUIMessage): Record<string, AgentEvent> {
  const events: Record<string, AgentEvent> = {};
  for (const part of message.parts) {
    const partType = (part as { type?: string }).type;
    if (partType === "data-run-item" || partType === "data-data-run-item") {
      const event = (part as unknown as { type: string; data: AgentEvent }).data;
      events[event.id] = event;
    }
  }
  return events;
}

/**
 * Extract ordered event IDs (by timestamp)
 */
function extractEventOrder(eventsById: Record<string, AgentEvent>): string[] {
  return Object.values(eventsById)
    .sort((a, b) => a.ts - b.ts)
    .map(event => event.id);
}

/**
 * Format elapsed time as "Ns" or "N min Ns"
 */
function formatElapsed(ms?: number): string {
  if (!ms) return "";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export const RunCard: Component<RunCardProps> = props => {
  const runCardData = createMemo(() => extractRunCardData(props.message));
  const files = createMemo(() => extractFiles(props.message));
  const groups = createMemo(() => extractGroups(props.message));
  const eventsById = createMemo(() => extractEvents(props.message));
  const eventOrder = createMemo(() => extractEventOrder(eventsById()));
  const fallbackFiles = createMemo(() => {
    const data = runCardData();
    if (!data?.filesEditedOrder?.length) return [];
    return data.filesEditedOrder.map(path => ({ path }));
  });
  const fallbackGroups = createMemo(() => {
    if (groups().length > 0 || eventOrder().length === 0) return [];
    const runId = runCardData()?.runId ?? "run";
    return [
      {
        id: `${runId}-group-1`,
        index: 1,
        title: "Progress Updates",
        collapsed: false,
        itemsOrder: eventOrder(),
      },
    ] as RunGroupData[];
  });

  const data = runCardData();

  return (
    <div class="ag-run-card animate-fade-in-up">
      {/* Header */}
      <div class="ag-run-card-header">
        <div class="flex flex-col gap-0.5">
          <div class="ag-run-card-title">{data?.title ?? "Planning Session"}</div>
          <Show when={data?.subtitle}>
            <div class="ag-run-card-subtitle">{data!.subtitle}</div>
          </Show>
        </div>
        <div class="flex items-center gap-3">
          <Show when={data?.elapsedMs}>
            <span class="text-muted-foreground font-mono text-xs">
              {formatElapsed(data!.elapsedMs)}
            </span>
          </Show>
          <StatusChip status={data?.status ?? "planning"} />
        </div>
      </div>

      {/* Files Section */}
      <Show when={files().length > 0 || fallbackFiles().length > 0}>
        <div class="ag-files-section">
          <div class="text-muted-foreground mb-2 text-xs font-medium">Files Edited</div>
          <For each={files().length > 0 ? files() : fallbackFiles()}>
            {file => <FileRow file={file} />}
          </For>
        </div>
      </Show>

      {/* Progress Groups */}
      <Show when={groups().length > 0 || fallbackGroups().length > 0}>
        <div class="ag-progress-section">
          <For each={groups().length > 0 ? groups() : fallbackGroups()}>
            {group => <ProgressGroup group={group} eventsById={eventsById()} />}
          </For>
        </div>
      </Show>

      {/* Thinking Indicator (if currently thinking) */}
      <Show when={data?.status === "planning" || data?.status === "executing"}>
        <div class="px-4 pb-3">
          <ThoughtIndicator status="thinking" />
        </div>
      </Show>
    </div>
  );
};

export default RunCard;
