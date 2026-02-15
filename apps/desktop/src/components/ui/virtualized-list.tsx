import { createMemo, createSignal, For, type Accessor, type JSX } from "solid-js";

export interface VirtualListProps<T> {
  /** Accessor for the items to render */
  items: Accessor<T[]>;
  /** Fixed height for each item (in pixels) */
  itemSize: number;
  /** Height of the container (in pixels) */
  containerHeight: number;
  /** Render function for each item */
  children: (item: T, index: Accessor<number>) => JSX.Element;
  /** Number of extra items to render outside viewport (default: 1) */
  overscan?: number;
}

/**
 * Virtualized list component for efficient rendering of large lists
 *
 * @example
 * ```tsx
 * const [items] = createSignal([...]); // 1000+ items
 *
 * <VirtualizedList
 *   items={items}
 *   itemSize={50}
 *   containerHeight={600}
 *   overscan={5}
 *   children={(item) => <div>{item.name}</div>}
 * />
 * ```
 */
export const VirtualizedList = <T,>(props: VirtualListProps<T>) => {
  const [scrollTop, setScrollTop] = createSignal(0);
  const overscan = createMemo(() => props.overscan ?? 3);
  const visibleWindow = createMemo(() => {
    const items = props.items();
    const start = Math.max(0, Math.floor(scrollTop() / props.itemSize) - overscan());
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop() + props.containerHeight) / props.itemSize) + overscan()
    );
    return { start, end, items };
  });

  const totalHeight = createMemo(() => props.items().length * props.itemSize);

  return (
    <div
      class="overflow-y-auto"
      style={{ height: `${props.containerHeight}px` }}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      data-component="virtualized-list"
    >
      <div class="relative w-full" style={{ height: `${totalHeight()}px` }}>
        <For each={visibleWindow().items.slice(visibleWindow().start, visibleWindow().end)}>
          {(item, localIndex) => {
            const absoluteIndex = () => visibleWindow().start + localIndex();
            return (
              <div
                class="absolute left-0 right-0"
                style={{
                  top: `${absoluteIndex() * props.itemSize}px`,
                  height: `${props.itemSize}px`,
                }}
              >
                {props.children(item, absoluteIndex)}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
