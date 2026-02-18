export interface LSPRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface LSPDiagnostic {
  severity: 1 | 2 | 3 | 4;
  message: string;
  range: LSPRange;
  source?: string;
}

export interface LSPServerInfo {
  id: string;
  name: string;
  extensions: string[];
  rootPatterns: string[];
}
