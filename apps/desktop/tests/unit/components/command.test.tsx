import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandRoot,
  CommandSeparator,
} from "@/components/ui/command";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Command primitives", () => {
  let container: HTMLDivElement;
  let dispose: () => void;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    dispose?.();
    document.body.removeChild(container);
  });

  it("renders accessible roles and triggers selection", () => {
    const onSelect = vi.fn();
    const [query, setQuery] = createSignal("");

    dispose = render(
      () => (
        <CommandRoot>
          <CommandInput value={query()} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty hidden={true}>No results</CommandEmpty>
            <CommandGroup heading="Connected">
              <CommandItem value="zai/glm-4.7" onPick={onSelect}>
                GLM 4.7
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </CommandList>
        </CommandRoot>
      ),
      container
    );

    const input = container.querySelector('input[role="combobox"]');
    const list = container.querySelector('[role="listbox"]');
    const item = container.querySelector('[role="option"]') as HTMLButtonElement;
    expect(input).toBeTruthy();
    expect(list).toBeTruthy();
    expect(item).toBeTruthy();

    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith("zai/glm-4.7");
  });

  it("renders command dialog in a fixed overlay portal", () => {
    dispose = render(
      () => (
        <CommandDialog open={true}>
          <div>Dialog content</div>
        </CommandDialog>
      ),
      container
    );

    expect(container.querySelector('button[aria-label="Close model selector"]')).toBeNull();
    const overlay = document.body.querySelector(
      'button[aria-label="Close model selector"]'
    ) as HTMLButtonElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.className).toContain("fixed");
    expect(overlay?.className).toContain("inset-0");
  });
});
