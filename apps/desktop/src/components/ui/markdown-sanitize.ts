const FENCE_DELIMITER_PATTERN = /^(\s{0,3})(`{3,}|~{3,})(.*)$/;
const DEFINITION_WITH_URL_PATTERN = /^\s{0,3}\[([^\]\n]+)\]:\s*(\S+)/;
const DEFINITION_MISSING_URL_PATTERN = /^\s{0,3}\[[^\]\n]+\]:\s*$/;
const REFERENCE_PATTERN = /(!?)\[([^\]\n]+)\]\[([^\]\n]*)\]/g;
const INCOMPLETE_INLINE_LINK_PATTERN = /(!?)\[([^\]\n]*)\]\(([^)\n]*)$/;
const SHORTCUT_REFERENCE_PATTERN = /\[([^\]\n]+)\](?![\[(])/g;
const SHORTCUT_IMAGE_REFERENCE_PATTERN = /!\[([^\]\n]+)\](?![\[(])/g;

function normalizeDefinitionLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function splitMarkdownAndFenceSegments(input: string): Array<{ text: string; isFence: boolean }> {
  const lines = input.split("\n");
  const segments: Array<{ text: string; isFence: boolean }> = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const withNewline = index < lines.length - 1 ? `${line}\n` : line;
    const isFenceLine = FENCE_DELIMITER_PATTERN.test(line);
    const isFenceSegment = inFence || isFenceLine;

    segments.push({ text: withNewline, isFence: isFenceSegment });

    if (isFenceLine) {
      inFence = !inFence;
    }
  }

  return segments;
}

function splitInlineCodeAware(input: string): Array<{ text: string; isInlineCode: boolean }> {
  const segments: Array<{ text: string; isInlineCode: boolean }> = [];
  let cursor = 0;

  while (cursor < input.length) {
    const tickStart = input.indexOf("`", cursor);
    if (tickStart === -1) {
      segments.push({ text: input.slice(cursor), isInlineCode: false });
      break;
    }

    if (tickStart > cursor) {
      segments.push({ text: input.slice(cursor, tickStart), isInlineCode: false });
    }

    let tickCount = 1;
    while (input[tickStart + tickCount] === "`") {
      tickCount += 1;
    }
    const marker = "`".repeat(tickCount);
    const end = input.indexOf(marker, tickStart + tickCount);

    if (end === -1) {
      segments.push({ text: input.slice(tickStart), isInlineCode: false });
      break;
    }

    segments.push({
      text: input.slice(tickStart, end + tickCount),
      isInlineCode: true,
    });
    cursor = end + tickCount;
  }

  return segments;
}

function collectDefinitionLabels(input: string): Set<string> {
  const labels = new Set<string>();
  const segments = splitMarkdownAndFenceSegments(input);
  for (const segment of segments) {
    if (segment.isFence) continue;
    const lines = segment.text.split("\n");
    for (const line of lines) {
      const definition = line.match(DEFINITION_WITH_URL_PATTERN);
      if (!definition) continue;
      const label = definition[1];
      const token = definition[2];
      if (!label || !token) continue;
      labels.add(normalizeDefinitionLabel(label));
    }
  }
  return labels;
}

function sanitizeLineDefinitions(line: string): string {
  if (!DEFINITION_MISSING_URL_PATTERN.test(line)) return line;
  const bracketIndex = line.indexOf("[");
  if (bracketIndex < 0) return line;
  if (bracketIndex > 0 && line[bracketIndex - 1] === "\\") return line;
  return `${line.slice(0, bracketIndex)}\\${line.slice(bracketIndex)}`;
}

function sanitizeUnresolvedReferences(input: string, definitions: Set<string>): string {
  return input.replace(REFERENCE_PATTERN, (match, bang, text, ref, offset: number, raw: string) => {
    if (offset > 0 && raw[offset - 1] === "\\") return match;
    const resolvedLabel = normalizeDefinitionLabel((ref && ref.length > 0 ? ref : text) ?? "");
    if (resolvedLabel.length > 0 && definitions.has(resolvedLabel)) return match;
    return `${bang}\\[${text}][${ref}]`;
  });
}

function sanitizeShortcutReferences(input: string, definitions: Set<string>): string {
  const withEscapedImages = input.replace(
    SHORTCUT_IMAGE_REFERENCE_PATTERN,
    (match, label, offset: number, raw: string) => {
      if (offset > 0 && raw[offset - 1] === "\\") return match;
      if (offset > 0 && raw[offset - 1] === "]") return match;
      const normalizedLabel = normalizeDefinitionLabel(label ?? "");
      if (normalizedLabel.length > 0 && definitions.has(normalizedLabel)) return match;
      return `!\\[${label}]`;
    }
  );

  return withEscapedImages.replace(
    SHORTCUT_REFERENCE_PATTERN,
    (match, label, offset: number, raw: string) => {
      if (offset > 0 && raw[offset - 1] === "\\") return match;
      if (offset > 0 && raw[offset - 1] === "]") return match;
      const normalizedLabel = normalizeDefinitionLabel(label ?? "");
      if (normalizedLabel.length > 0 && definitions.has(normalizedLabel)) return match;
      return `\\[${label}]`;
    }
  );
}

function sanitizeIncompleteInlineLinks(input: string): string {
  return input
    .split("\n")
    .map(line =>
      line.replace(
        INCOMPLETE_INLINE_LINK_PATTERN,
        (match, bang, label, urlPart, offset: number) => {
          if (offset > 0 && line[offset - 1] === "\\") return match;
          return `${bang}\\[${label}](${urlPart}`;
        }
      )
    )
    .join("\n");
}

function sanitizeMarkdownSegment(input: string, definitions: Set<string>): string {
  const lines = input.split("\n").map(sanitizeLineDefinitions).join("\n");
  const inlineSegments = splitInlineCodeAware(lines);
  return inlineSegments
    .map(segment => {
      if (segment.isInlineCode) return segment.text;
      const referencesSafe = sanitizeUnresolvedReferences(segment.text, definitions);
      const shortcutsSafe = sanitizeShortcutReferences(referencesSafe, definitions);
      return sanitizeIncompleteInlineLinks(shortcutsSafe);
    })
    .join("");
}

export function sanitizeForIncremark(input: string): string {
  if (!input) return input;
  const definitions = collectDefinitionLabels(input);
  const segments = splitMarkdownAndFenceSegments(input);
  return segments
    .map(segment => {
      if (segment.isFence) return segment.text;
      return sanitizeMarkdownSegment(segment.text, definitions);
    })
    .join("");
}
