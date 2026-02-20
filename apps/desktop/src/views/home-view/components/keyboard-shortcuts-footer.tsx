export function KeyboardShortcutsFooter() {
  return (
    <div
      class="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs"
      data-test="keyboard-shortcuts-footer"
    >
      <span class="flex items-center gap-1">
        <kbd class="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">⌘1-9</kbd>
        <span>to focus</span>
      </span>
      <span class="opacity-50">•</span>
      <span class="flex items-center gap-1">
        <kbd class="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">Arrows</kbd>
        <span>to navigate</span>
      </span>
      <span class="opacity-50">•</span>
      <span class="flex items-center gap-1">
        <kbd class="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">Enter</kbd>
        <span>to open</span>
      </span>
      <span class="opacity-50">•</span>
      <span class="flex items-center gap-1">
        <kbd class="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">⌘K</kbd>
        <span>to search</span>
      </span>
      <span class="opacity-50">•</span>
      <span class="flex items-center gap-1">
        <kbd class="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">⌘N</kbd>
        <span>new workspace</span>
      </span>
    </div>
  );
}
