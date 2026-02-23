import { cn } from "@/utils";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";

export function Markdown(props: { text: string; class?: string; isStreaming?: boolean }) {
  const [runId, setRunId] = createSignal(0);

  createEffect(() => {
    setRunId(prev => prev + 1);
  });

  onCleanup(() => {});

  return (
    <div
      data-component="markdown"
      data-run-id={runId()}
      class={cn("prose prose-sm max-w-none", props.class)}
    >
      <Show when={props.text} keyed>
        {_text => <div innerHTML={props.text} />}
      </Show>
    </div>
  );
}
