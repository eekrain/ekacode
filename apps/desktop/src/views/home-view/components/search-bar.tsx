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
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="search-icon"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
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
          ×
        </button>
      )}
    </div>
  );
}
