import { ModelSelector, type ModelSelectorSection } from "@/components/model-selector";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ModelSelector command center", () => {
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

  it("virtualizes model rows in the selector", () => {
    const sections: ModelSelectorSection[] = [
      {
        providerId: "zai",
        providerName: "Z.AI",
        connected: true,
        models: Array.from({ length: 120 }, (_, index) => ({
          id: `zai/glm-${index}`,
          providerId: "zai",
          name: `GLM ${index}`,
          connected: true,
        })),
      },
    ];

    dispose = render(
      () => (
        <ModelSelector
          open={true}
          onOpenChange={vi.fn()}
          selectedModelId="zai/glm-0"
          mode="model"
          onModeChange={vi.fn()}
          modelSections={sections}
          onSearchChange={vi.fn()}
          onSelect={vi.fn()}
        />
      ),
      container
    );

    const options = document.body.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(120);
    expect(
      document.body.querySelector('[data-component="model-selector-virtual-list"]')
    ).toBeTruthy();
  });

  it("keeps provider heading visible in virtualized list", () => {
    const sections: ModelSelectorSection[] = [
      {
        providerId: "zai",
        providerName: "Z.AI",
        connected: true,
        models: [
          { id: "zai/glm-4.7", providerId: "zai", name: "GLM 4.7", connected: true },
          { id: "zai/glm-4.6", providerId: "zai", name: "GLM 4.6", connected: true },
        ],
      },
    ];

    dispose = render(
      () => (
        <ModelSelector
          open={true}
          onOpenChange={vi.fn()}
          selectedModelId="zai/glm-4.7"
          mode="model"
          onModeChange={vi.fn()}
          modelSections={sections}
          onSearchChange={vi.fn()}
          onSelect={vi.fn()}
        />
      ),
      container
    );

    expect(document.body.textContent).toContain("Z.AI");
  });
});
