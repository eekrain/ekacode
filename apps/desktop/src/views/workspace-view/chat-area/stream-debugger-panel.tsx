/**
 * StreamDebuggerPanel Component - Aggregated View by Message ID
 *
 * Shows how each message evolves as stream events come in.
 * Groups all events by message ID to visualize the data flow.
 */
import { Component, createMemo, createSignal, For, Show } from "solid-js";
import { CollapsibleJson } from "/@/components/collapsible-json";
import type { StreamEvent, UseStreamDebuggerResult } from "/@/hooks/use-stream-debugger";
import { cn } from "/@/lib/utils";

interface StreamDebuggerPanelProps {
  debugger: UseStreamDebuggerResult;
  onClose: () => void;
  class?: string;
}

interface MessageAggregation {
  id: string;
  events: StreamEvent[];
  firstEvent: number;
  lastEvent: number;
  eventTypes: Set<string>;
}

/**
 * Aggregate events by message ID
 */
function aggregateByMessageId(events: StreamEvent[]): MessageAggregation[] {
  const groups = new Map<string, StreamEvent[]>();

  // Group events by message ID
  for (const event of events) {
    const msgId = event.messageId || "no-id";
    if (!groups.has(msgId)) {
      groups.set(msgId, []);
    }
    groups.get(msgId)!.push(event);
  }

  // Convert to array and sort by first event timestamp
  return Array.from(groups.entries())
    .map(([id, events]) => ({
      id,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
      firstEvent: events[0]?.timestamp || 0,
      lastEvent: events[events.length - 1]?.timestamp || 0,
      eventTypes: new Set(events.map(e => e.type)),
    }))
    .sort((a, b) => a.firstEvent - b.firstEvent);
}

/**
 * Get event type icon
 */
function getEventIcon(type: string): string {
  switch (type) {
    case "text-delta":
      return "📝";
    case "tool-call-start":
      return "🔧";
    case "tool-call-delta":
      return "🔧";
    case "tool-call-end":
      return "🔧";
    case "tool-result":
      return "✅";
    case "data-part":
      return "📦";
    case "error":
      return "❌";
    case "complete":
      return "🏁";
    case "message-start":
      return "📨";
    default:
      return "•";
  }
}

/**
 * Get event type color
 */
function getEventColor(type: string): string {
  switch (type) {
    case "text-delta":
      return "text-blue-400";
    case "tool-call-start":
    case "tool-call-delta":
    case "tool-call-end":
      return "text-yellow-400";
    case "tool-result":
      return "text-green-400";
    case "data-part":
      return "text-purple-400";
    case "error":
      return "text-red-400";
    case "complete":
      return "text-gray-400";
    case "message-start":
      return "text-cyan-400";
    default:
      return "text-gray-400";
  }
}

/**
 * Format timestamp
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

/**
 * Individual message card showing its evolution
 */
const MessageCard: Component<{
  aggregation: MessageAggregation;
  isExpanded: boolean;
  onToggle: () => void;
  selectedEvent: string | null;
  onSelectEvent: (eventId: string) => void;
}> = props => {
  const lastSnapshot = () =>
    props.aggregation.events[props.aggregation.events.length - 1]?.storeSnapshot;

  // Build text content from text-delta events
  const textContent = createMemo(() => {
    return props.aggregation.events
      .filter(e => e.type === "text-delta")
      .map(e => (e.payload as { delta?: string })?.delta || "")
      .join("");
  });

  return (
    <div class="border-border/30 border-b last:border-b-0">
      {/* Message Header */}
      <button
        onClick={props.onToggle}
        class={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left",
          "hover:bg-muted/30 transition-colors",
          props.isExpanded && "bg-muted/20"
        )}
      >
        {/* Expand icon */}
        <span
          class={cn(
            "text-xs transition-transform duration-150",
            props.isExpanded ? "rotate-90" : ""
          )}
        >
          ▶
        </span>

        {/* Message ID */}
        <div class="flex flex-col">
          <span class="text-foreground font-mono text-xs">
            {props.aggregation.id === "no-id"
              ? "(no message ID)"
              : props.aggregation.id.slice(0, 30)}
            {props.aggregation.id.length > 30 ? "..." : ""}
          </span>
          <span class="text-muted-foreground text-[10px]">
            {props.aggregation.events.length} events • {formatTime(props.aggregation.firstEvent)}
          </span>
        </div>

        {/* Event type indicators */}
        <div class="ml-auto flex items-center gap-1">
          <For each={Array.from(props.aggregation.eventTypes)}>
            {type => (
              <span class={cn("text-xs", getEventColor(type))} title={type}>
                {getEventIcon(type)}
              </span>
            )}
          </For>
        </div>
      </button>

      {/* Expanded Content */}
      <Show when={props.isExpanded}>
        <div class="border-border/20 border-t bg-black/5 dark:bg-white/5">
          {/* Text Preview (if any text-delta events) */}
          <Show when={textContent()}>
            <div class="border-border/20 border-b px-4 py-2">
              <div class="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">
                Accumulated Text
              </div>
              <div class="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
                {textContent()}
              </div>
            </div>
          </Show>

          {/* Events Timeline */}
          <div class="px-4 py-2">
            <div class="text-muted-foreground mb-2 text-[10px] uppercase tracking-wider">
              Event Timeline
            </div>
            <div class="space-y-1">
              <For each={props.aggregation.events}>
                {(event, index) => (
                  <button
                    onClick={() => props.onSelectEvent(event.id)}
                    class={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs",
                      "hover:bg-muted/50 transition-colors",
                      props.selectedEvent === event.id && "bg-primary/10 ring-primary/30 ring-1"
                    )}
                  >
                    <span class={getEventColor(event.type)}>{getEventIcon(event.type)}</span>
                    <span class="text-muted-foreground w-16 font-mono">
                      +
                      {index() === 0
                        ? "0ms"
                        : `${event.timestamp - props.aggregation.events[0].timestamp}ms`}
                    </span>
                    <span class={cn("flex-1 truncate", getEventColor(event.type))}>
                      {event.type}
                    </span>
                    <Show when={event.type === "text-delta"}>
                      <span class="text-muted-foreground max-w-[200px] truncate">
                        {(event.payload as { delta?: string })?.delta?.slice(0, 50)}
                      </span>
                    </Show>
                    <Show when={event.type === "tool-call-start"}>
                      <span class="text-muted-foreground">
                        {(event.payload as { toolName?: string })?.toolName}
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Selected Event Details */}
          <Show when={props.selectedEvent}>
            {eventId => {
              const event = props.aggregation.events.find(e => e.id === eventId());
              if (!event) return null;
              return (
                <div class="border-border/20 border-t px-4 py-3">
                  <div class="text-muted-foreground mb-2 text-[10px] uppercase tracking-wider">
                    Event Details • {formatTime(event.timestamp)}
                  </div>

                  {/* Payload */}
                  <div class="mb-3">
                    <div class="text-muted-foreground mb-1 text-[10px]">Payload:</div>
                    <CollapsibleJson data={event.payload} initialDepth={2} class="text-xs" />
                  </div>

                  {/* Store Snapshot */}
                  <div>
                    <div class="text-muted-foreground mb-1 text-[10px]">
                      Store State After Event:
                    </div>
                    <CollapsibleJson data={event.storeSnapshot} initialDepth={1} class="text-xs" />
                  </div>
                </div>
              );
            }}
          </Show>

          {/* Final State */}
          <Show when={lastSnapshot()}>
            {snapshot => (
              <div class="border-border/20 border-t px-4 py-3">
                <div class="text-muted-foreground mb-2 text-[10px] uppercase tracking-wider">
                  Final Message State
                </div>
                {(() => {
                  const msg = snapshot().messages?.byId?.[props.aggregation.id];
                  if (!msg)
                    return (
                      <span class="text-muted-foreground text-xs">
                        Message not found in final state
                      </span>
                    );
                  return <CollapsibleJson data={msg} initialDepth={2} class="text-xs" />;
                })()}
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
};

/**
 * Main StreamDebuggerPanel component
 */
export const StreamDebuggerPanel: Component<StreamDebuggerPanelProps> = props => {
  const [expandedMessages, setExpandedMessages] = createSignal<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = createSignal<string | null>(null);
  const [showRawStream, setShowRawStream] = createSignal(false);

  // Aggregate events by message ID
  const messageAggregations = createMemo(() => {
    const events = props.debugger.events();
    return aggregateByMessageId(events);
  });

  // Toggle message expansion
  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Clear all
  const handleClear = () => {
    props.debugger.clear();
    setExpandedMessages(new Set<string>());
    setSelectedEvent(null);
  };

  return (
    <div class={cn("bg-background flex h-full flex-col", "border-border/30 border-t", props.class)}>
      {/* Header */}
      <div class="border-border/30 bg-card/5 flex items-center justify-between border-b px-4 py-3">
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium">📊 Stream Debugger</span>
          <span class="text-muted-foreground text-xs">
            {messageAggregations().length} messages • {props.debugger.events().length} events
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick={() => setShowRawStream(!showRawStream())}
            class={cn(
              "rounded px-2 py-1 text-xs transition-colors",
              showRawStream()
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Raw Stream
          </button>

          <button
            onClick={handleClear}
            class="bg-muted text-muted-foreground hover:bg-muted/80 rounded px-2 py-1 text-xs transition-colors"
          >
            Clear
          </button>

          <button
            onClick={props.onClose}
            class="bg-muted text-muted-foreground hover:bg-muted/80 rounded px-2 py-1 text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Main content */}
      <div class="flex flex-1 overflow-hidden">
        {/* Messages list */}
        <div class={cn("flex-1 overflow-y-auto", showRawStream() ? "w-1/2" : "w-full")}>
          <Show
            when={messageAggregations().length > 0}
            fallback={
              <div class="text-muted-foreground flex h-full items-center justify-center text-sm">
                No events captured yet. Send a message to see the stream.
              </div>
            }
          >
            <For each={messageAggregations()}>
              {agg => (
                <MessageCard
                  aggregation={agg}
                  isExpanded={expandedMessages().has(agg.id)}
                  onToggle={() => toggleMessage(agg.id)}
                  selectedEvent={selectedEvent()}
                  onSelectEvent={setSelectedEvent}
                />
              )}
            </For>
          </Show>
        </div>

        {/* Raw stream panel */}
        <Show when={showRawStream()}>
          <div class="border-border/30 w-1/2 overflow-y-auto border-l bg-black/5 dark:bg-white/5">
            <div class="bg-background/95 border-border/30 sticky top-0 border-b px-3 py-2 text-xs font-medium backdrop-blur">
              Raw Stream Lines
            </div>
            <div class="space-y-1 p-3 font-mono text-xs">
              <For each={props.debugger.rawLines()}>
                {(line, index) => (
                  <div class="text-muted-foreground hover:text-foreground break-all transition-colors">
                    <span class="text-muted-foreground/50 mr-2">{index() + 1}</span>
                    {line}
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default StreamDebuggerPanel;
