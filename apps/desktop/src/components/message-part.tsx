import { Show, createSignal, type Component } from "solid-js";

interface MessagePartProps {
  part: Record<string, unknown>;
  message: unknown;
}

function titleCaseToolName(name: string): string {
  return name
    .split(/[_-]/g)
    .filter(Boolean)
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function compactNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return `${value}`;
}

export const Part: Component<MessagePartProps> = props => {
  const [showToolOutput, setShowToolOutput] = createSignal(false);
  const [showReasoning, setShowReasoning] = createSignal(true);
  const partType = () => (typeof props.part.type === "string" ? props.part.type : "");

  switch (partType()) {
    case "text":
      return (
        <div data-component="text-part">
          <div data-component="markdown">{String(props.part.text ?? "")}</div>
        </div>
      );
    case "tool": {
      const state =
        props.part.state && typeof props.part.state === "object"
          ? (props.part.state as Record<string, unknown>)
          : {};
      const status = String(state.status ?? "");
      const tool = titleCaseToolName(String(props.part.tool ?? "tool"));
      const output = state.output;
      return (
        <div data-component={status === "completed" ? "tool-completed" : "tool-pending"}>
          <button data-slot="tool-header" type="button" onClick={() => setShowToolOutput(v => !v)}>
            <span data-slot="tool-title">{tool}</span>
          </button>
          <Show when={status === "completed" && showToolOutput()}>
            <div data-slot="tool-output">{typeof output === "string" ? output : ""}</div>
          </Show>
        </div>
      );
    }
    case "reasoning":
      return (
        <div data-component="reasoning-part">
          <button
            data-slot="reasoning-header"
            type="button"
            onClick={() => setShowReasoning(v => !v)}
          >
            Reasoning
          </button>
          <Show when={showReasoning()}>
            <div data-slot="reasoning-content">{String(props.part.text ?? "")}</div>
          </Show>
        </div>
      );
    case "file":
      return (
        <div data-component="file-part">
          <span data-slot="file-name">{String(props.part.filename ?? "")}</span>
        </div>
      );
    case "error":
      return (
        <div data-component="error-part">
          <span data-slot="error-message">{String(props.part.message ?? "")}</span>
        </div>
      );
    case "snapshot": {
      const snapshot = String(props.part.snapshot ?? "");
      const lineCount = snapshot.length === 0 ? 0 : snapshot.split("\n").length;
      return (
        <div data-component="snapshot-part">
          <span data-slot="snapshot-stats">{lineCount} lines</span>
        </div>
      );
    }
    case "patch": {
      const hash = String(props.part.hash ?? "");
      const files = Array.isArray(props.part.files) ? props.part.files : [];
      return (
        <div data-component="patch-part">
          <span data-slot="patch-hash">{hash.slice(0, 8)}</span>
          {files.map(line => {
            const text = String(line);
            if (text.startsWith("+") && !text.startsWith("+++")) {
              return <div data-line-type="add">{text}</div>;
            }
            if (text.startsWith("-") && !text.startsWith("---")) {
              return <div data-line-type="remove">{text}</div>;
            }
            return <div>{text}</div>;
          })}
        </div>
      );
    }
    case "step-start":
      return (
        <div data-component="step-start-part">
          <span data-slot="step-start-snapshot">{String(props.part.snapshot ?? "")}</span>
        </div>
      );
    case "step-finish": {
      const cost = Number(props.part.cost ?? 0);
      const tokens =
        props.part.tokens && typeof props.part.tokens === "object"
          ? (props.part.tokens as Record<string, unknown>)
          : {};
      const input = Number(tokens.input ?? 0);
      return (
        <div data-component="step-finish-part">
          <span data-slot="step-finish-cost">${cost.toFixed(4)}</span>
          <span data-slot="stat-input">{compactNumber(input)}</span>
        </div>
      );
    }
    default:
      return null;
  }
};

export default Part;
