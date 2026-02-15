import Resizable from "@corvu/resizable";

export const ResizeableHandle = () => (
  <Resizable.Handle aria-label="Resize left panel" class="group relative z-10 -mx-1 w-2.5">
    <div class="bg-border/40 group-hover:bg-primary/50 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150" />
    {/* Hover glow indicator */}
    <div class="pointer-events-none absolute inset-y-0 -left-1 -right-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
      <div class="bg-primary/5 h-full w-full" />
    </div>
  </Resizable.Handle>
);
