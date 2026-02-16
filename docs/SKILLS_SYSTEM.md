# OpenCode Skills System Documentation

## Overview

Agent skills in OpenCode are a mechanism to provide domain-specific instructions and workflows that can be loaded dynamically during a conversation. They allow the AI to recognize tasks that match specialized skills and load detailed instructions into the context.

---

## Architecture

### Core Components

| File                     | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `src/skill/skill.ts`     | Skill discovery, storage, and state management |
| `src/skill/discovery.ts` | Remote skill discovery via HTTP URLs           |
| `src/tool/skill.ts`      | The `skill` tool implementation                |
| `src/tool/registry.ts`   | Tool registration (includes SkillTool)         |
| `src/permission/next.ts` | Permission evaluation for skills               |
| `src/config/config.ts`   | Skills configuration schema                    |

### Skill Definition

Skills are defined as `SKILL.md` files with YAML frontmatter:

```yaml
---
name: <skill-name>
description: <when to use this skill>
---
# Skill Content

Your skill instructions here...
```

**Required Frontmatter Fields:**

- `name` (string) - The skill identifier
- `description` (string) - Brief description of when to use the skill

### Skill Info Schema

```typescript
export const Info = z.object({
  name: z.string(),
  description: z.string(),
  location: z.string(), // Path to SKILL.md
  content: z.string(), // Full markdown content
});
```

---

## Skill Discovery Locations

Skills are discovered in the following locations (in priority order):

### 1. External Directories (Claude Code Compatible)

```
~/.claude/skills/<name>/SKILL.md
~/.agents/skills/<name>/SKILL.md
<project>/.claude/skills/<name>/SKILL.md
<project>/.agents/skills/<name>/SKILL.md
```

These directories provide compatibility with Claude Code and other agents.

### 2. OpenCode Native Directories

```
~/.config/opencode/skills/<name>/SKILL.md
<project>/.opencode/skills/<name>/SKILL.md
<project>/.opencode/skill/<name>/SKILL.md
```

### 3. Additional Paths (Config)

Skills can be loaded from custom paths defined in `opencode.json`:

```json
{
  "skills": {
    "paths": ["/path/to/custom/skills"]
  }
}
```

### 4. Remote Skills (HTTP URL)

Skills can be fetched from remote URLs in `opencode.json`:

```json
{
  "skills": {
    "urls": ["https://example.com/.well-known/skills/"]
  }
}
```

**Remote Index Format (`index.json`):**

```json
{
  "skills": [
    {
      "name": "skill-name",
      "description": "Skill description",
      "files": ["SKILL.md", "references/doc.md", "scripts/helper.sh"]
    }
  ]
}
```

Remote skills are cached in `~/.cache/opencode/skills/`.

---

## Skill Tool

### Tool Definition

The skill tool is registered in the tool registry and can be invoked by the LLM.

**Tool ID:** `skill`

**Parameters:**

```typescript
z.object({
  name: z.string().describe("The name of the skill from available_skills"),
});
```

### Execution Flow

1. **List Available Skills**: When initialized, the tool lists all available skills filtered by agent permissions
2. **Skill Invocation**: When called with a skill name:
   - Loads the skill's `SKILL.md` content
   - Scans up to 10 additional files from the skill directory
   - Returns a `<skill_content>` block

### Output Format

```xml
<skill_content name="skill-name">
# Skill: skill-name

[Skill content from SKILL.md]

Base directory for this skill: file:///path/to/skill
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
<file>/path/to/file1.ts</file>
<file>/path/to/file2.md</file>
</skill_files>
</skill_content>
```

---

## Permission System

Skills have their own permission category in the permission system.

### Configuration

In `opencode.json`, agents can have skill permissions configured:

```json
{
  "agents": {
    "myagent": {
      "permission": {
        "skill": {
          "frontend-design": "allow",
          "writing-*": "ask",
          "*": "deny"
        }
      }
    }
  }
}
```

### Permission Actions

- `allow` - Always permit using the skill
- `ask` - Prompt user for permission each time
- `deny` - Never allow using the skill

### Permission Evaluation

```typescript
const accessibleSkills = skills.filter(skill => {
  const rule = PermissionNext.evaluate("skill", skill.name, agent.permission);
  return rule.action !== "deny";
});
```

---

## Configuration Schema

### Skills Configuration (`src/config/config.ts`)

```typescript
export const Skills = z.object({
  paths: z.array(z.string()).optional().describe("Additional paths to skill folders"),
  urls: z.array(z.string()).optional().describe("URLs to fetch skills from"),
});
```

### Permission Schema

```typescript
// skill is one of the permission categories
const PermissionRule = z.object({
  permission: z.string(),
  pattern: z.string(),
  action: z.enum(["allow", "deny", "ask"]),
});
```

---

## API Endpoint

Skills are exposed via a REST API endpoint:

- **Endpoint:** `GET /skill`
- **Response:** Array of skill objects

```json
[
  {
    "name": "skill-name",
    "description": "Skill description",
    "location": "/path/to/SKILL.md",
    "content": "Full SKILL.md content..."
  }
]
```

---

## Frontmatter Parsing

OpenCode uses the `gray-matter` library to parse YAML frontmatter with a fallback for invalid YAML (for Claude Code compatibility).

### Primary Parser

```typescript
import matter from "gray-matter";

const md = matter(template);
```

### Fallback Parser

For invalid YAML (like that produced by Claude Code), OpenCode has a fallback that:

1. Strips comments from frontmatter
2. Escapes colons in values using block scalar (`|`)
3. Allows invalid YAML to parse successfully

---

## Comparison: OpenCode vs OpenSkills

### System Overview

| Aspect           | OpenCode Skills              | OpenSkills                          |
| ---------------- | ---------------------------- | ----------------------------------- |
| **Type**         | Built-in agent framework     | Standalone CLI tool                 |
| **Integration**  | Native tool in OpenCode      | External package (`npx openskills`) |
| **Skill Format** | YAML frontmatter in SKILL.md | YAML frontmatter in SKILL.md        |

### Feature Comparison

| Feature               | OpenCode                                                  | OpenSkills                                                       | Winner         |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- | -------------- |
| **Local Discovery**   | `.claude/skills/`, `.agents/skills/`, `.opencode/skills/` | `.claude/skills/`, `.agent/skills/`                              | **OpenCode**   |
| **Remote Skills**     | Yes (HTTP URL with index.json)                            | Yes (git clone, GitHub shorthand)                                | **OpenSkills** |
| **CLI Commands**      | No dedicated CLI                                          | Full CLI (`install`, `read`, `list`, `sync`, `remove`, `update`) | **OpenSkills** |
| **Skill Metadata**    | Stored in frontmatter only                                | Separate `.openskills.json` (source tracking)                    | **OpenSkills** |
| **AGENTS.md Sync**    | No                                                        | Yes (`sync` command)                                             | **OpenSkills** |
| **Permission System** | Per-agent permissions in opencode.json                    | No (relies on agent config)                                      | **OpenCode**   |
| **API Endpoint**      | Yes (`GET /skill`)                                        | No                                                               | **OpenCode**   |
| **Caching**           | Yes (`~/.cache/opencode/skills/`)                         | No                                                               | **OpenCode**   |
| **Native Tool**       | Yes (`skill` tool auto-registered                         | No                                                               | **OpenCode**   |

### Frontmatter Schema Comparison

| Field         | OpenCode    | OpenSkills  | Anthropic Spec   |
| ------------- | ----------- | ----------- | ---------------- |
| `name`        | ✅ Required | ✅ Required | ✅ Required      |
| `description` | ✅ Required | ✅ Required | ✅ Required      |
| `context`     | ❌ Not used | ✅ Optional | ❌ (not in spec) |

### Key Differences

| Issue           | OpenCode                        | OpenSkills            | Follows Anthropic? |
| --------------- | ------------------------------- | --------------------- | ------------------ |
| Required Fields | `name`, `description`           | `name`, `description` | ✅ Yes             |
| Extra Fields    | None                            | `context`             | ❌ No              |
| YAML Parser     | gray-matter (strict) + fallback | Regex (permissive)    | ⚠️ Partial         |
| Invalid YAML    | ✅ Handles gracefully           | ✅ Handles gracefully | N/A                |

---

## Anthropic SKILL.md Format Compliance

Both OpenCode and OpenSkills follow the Anthropic SKILL.md specification:

```yaml
---
name: <skill-name>
description: <when to use this skill>
---
# Skill Content

Your skill instructions here...
```

**Requirements:**

1. File must be named `SKILL.md`
2. Must have valid YAML frontmatter starting with `---`
3. Must have `name` and `description` fields in frontmatter
4. Content after frontmatter is free-form markdown

**Best Practices (from Anthropic):**

- Write in imperative/infinitive form: "To do X, execute Y"
- NOT second person: avoid "You should..."
- Keep SKILL.md under 5,000 words
- Move detailed content to `references/`
- Use `scripts/` for executable code
- Use `assets/` for templates and output files

---

## Advantages & Disadvantages

### OpenCode Skills

**Advantages:**

1. **Native integration** - Skills are built-in, no external dependencies
2. **Permission controls** - Per-agent skill restrictions via `opencode.json`
3. **REST API** - Built-in endpoint for skill listing
4. **Caching** - Remote skills cached locally
5. **More discovery paths** - Supports `.opencode/skills/`, config paths
6. **Deduplication** - Handles duplicate skill names gracefully
7. **OpenCode-native** - Works seamlessly in OpenCode workflow

**Disadvantages:**

1. **No CLI** - No standalone commands for managing skills
2. **No git support** - Cannot install from GitHub repos directly
3. **No AGENTS.md sync** - Must manually update documentation
4. **No metadata tracking** - Can't track skill source/origin
5. **Limited remote** - Only HTTP URL discovery (no git)
6. **No update mechanism** - No command to update installed skills
7. **No interactive install** - Can't select skills during install

### OpenSkills

**Advantages:**

1. **Full CLI** - `install`, `read`, `list`, `sync`, `remove`, `update`
2. **GitHub integration** - Install via `owner/repo` or full git URLs
3. **AGENTS.md sync** - Auto-generates skills section in AGENTS.md
4. **Metadata tracking** - Stores source info in `.openskills.json`
5. **Interactive prompts** - Select skills during install
6. **Update command** - Can update installed skills
7. **Conflict detection** - Warns about marketplace conflicts
8. **Portable** - Works with Claude Code and other agents

**Disadvantages:**

1. **External dependency** - Requires `npx openskills` or npm install
2. **No native tool** - Must run shell command to read skills
3. **No permission system** - Relies on agent config alone
4. **No API** - No REST endpoint for listing
5. **No caching** - Re-clones git repos on each operation
6. **Less discovery paths** - Only `.claude/` and `.agent/`
7. **No HTTP URL discovery** - Can't fetch from arbitrary URLs
8. **Bash dependency** - Requires shell execution

---

## Conclusion

**OpenCode is superior** for OpenCode users because:

- Skills are natively integrated as a tool
- Permission system allows per-agent access control
- REST API enables programmatic access
- Caching improves performance
- Works out of the box without external dependencies

**OpenSkills is better** as a standalone skill management tool for:

- Managing skills across different agents (Claude Code, etc.)
- CI/CD integration
- GitHub-based workflows
- AGENTS.md documentation

Both systems are Anthropic-spec compliant for the core SKILL.md format. Use standard YAML frontmatter with only `name` and `description` - both systems will work.

---

## Files Reference

| Path                                       | Description                          |
| ------------------------------------------ | ------------------------------------ |
| `packages/opencode/src/skill/skill.ts`     | Skill discovery and state management |
| `packages/opencode/src/skill/discovery.ts` | Remote skill discovery               |
| `packages/opencode/src/tool/skill.ts`      | Skill tool implementation            |
| `packages/opencode/src/tool/registry.ts`   | Tool registration                    |
| `packages/opencode/src/permission/next.ts` | Permission evaluation                |
| `packages/opencode/src/config/config.ts`   | Configuration schema                 |
| `packages/opencode/src/config/markdown.ts` | Frontmatter parsing                  |
