import { Search, X } from "lucide-solid";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  resultsCount?: number;
  autoFocus?: boolean;
}

export function SearchBar(props: SearchBarProps) {
  return (
    <div class="search-bar">
      <Search width={16} height={16} class="search-icon" />
      <input
        type="text"
        class="search-input"
        placeholder="Search workspaces..."
        value={props.value}
        onInput={e => props.onChange(e.currentTarget.value)}
        autofocus={props.autoFocus}
      />
      {props.resultsCount !== undefined && (
        <span class="search-results-count" data-test="results-count">
          {props.resultsCount}
        </span>
      )}
      {props.value && (
        <button class="search-clear" onClick={props.onClear} aria-label="Clear search">
          <X width={16} height={16} />
        </button>
      )}
    </div>
  );
}
