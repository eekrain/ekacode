import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils";
import { ArrowRight, ChevronDown, CircleDashed } from "lucide-solid";
import { createSignal } from "solid-js";

interface WorkspaceContextBarProps {
  projectName: string;
  selectedBranch: string | null;
  branches: string[];
  onCreateSpace: () => void;
  onBranchChange: (branch: string) => void;
  onCancel: () => void;
  class?: string;
}

export function WorkspaceContextBar(props: WorkspaceContextBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);

  const handleBranchChange = (branch: string) => {
    props.onBranchChange(branch);
    setIsDropdownOpen(false);
  };

  return (
    <div class={cn("mt-4 flex items-center justify-between", props.class)}>
      <div class="flex items-center gap-2">
        <CircleDashed width={18} height={18} class="text-muted-foreground" />
        <span class="text-muted-foreground">
          Work on <span class="text-foreground font-medium">{props.projectName}</span>
        </span>
        {props.selectedBranch && (
          <>
            <span class="text-muted-foreground">x off</span>
            <DropdownMenu open={isDropdownOpen()} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger
                as="button"
                class={cn(
                  "group relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5",
                  "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-all duration-200",
                  "focus-visible:ring-primary/50 focus-visible:outline-none focus-visible:ring-2"
                )}
              >
                <span class="font-medium">{props.selectedBranch}</span>
                <ChevronDown
                  width={14}
                  height={14}
                  class="transition-transform duration-200 group-hover:rotate-180"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup
                  value={props.selectedBranch}
                  onChange={handleBranchChange}
                  class="py-1"
                >
                  <div class="min-w-[200px] space-y-0.5">
                    {props.branches.map(branch => (
                      <DropdownMenuRadioItem
                        value={branch}
                        class={cn(
                          branch === props.selectedBranch && "bg-primary text-primary-foreground"
                        )}
                      >
                        {branch}
                      </DropdownMenuRadioItem>
                    ))}
                  </div>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onCancel}
          class={cn(
            "text-muted-foreground hover:text-foreground text-sm font-medium transition-colors duration-150",
            "focus-visible:ring-primary/50 rounded px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2"
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={props.onCreateSpace}
          class={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
            "focus-visible:ring-primary/50 focus-visible:outline-none focus-visible:ring-2",
            "hover:-translate-y-0.5 hover:shadow-md",
            "bg-primary text-primary-foreground hover:bg-primary/90 active:translate-y-0 active:scale-95"
          )}
        >
          <span>Create space</span>
          <ArrowRight width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
