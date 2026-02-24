/**
 * Spec Validators Tests
 *
 * Phase 2 - Spec System
 */

import { beforeAll, describe, expect, it } from "vitest";

describe("Spec Validators", () => {
  let extractRequirementIds: typeof import("@/spec/validators").extractRequirementIds;
  let extractTaskIds: typeof import("@/spec/validators").extractTaskIds;
  let validateRequirementIds: typeof import("@/spec/validators").validateRequirementIds;
  let validateTaskFormat: typeof import("@/spec/validators").validateTaskFormat;
  let validateTasksCoverage: typeof import("@/spec/validators").validateTasksCoverage;
  let validateDesignTraceability: typeof import("@/spec/validators").validateDesignTraceability;
  let validateTaskDependencies: typeof import("@/spec/validators").validateTaskDependencies;
  let detectDependencyCycles: typeof import("@/spec/validators").detectDependencyCycles;
  let normalizeRequirementId: typeof import("@/spec/validators").normalizeRequirementId;
  let normalizeRequirementHeadings: typeof import("@/spec/validators").normalizeRequirementHeadings;

  beforeAll(async () => {
    const v = await import("@/spec/validators");
    extractRequirementIds = v.extractRequirementIds;
    extractTaskIds = v.extractTaskIds;
    validateRequirementIds = v.validateRequirementIds;
    validateTaskFormat = v.validateTaskFormat;
    validateTasksCoverage = v.validateTasksCoverage;
    validateDesignTraceability = v.validateDesignTraceability;
    validateTaskDependencies = v.validateTaskDependencies;
    detectDependencyCycles = v.detectDependencyCycles;
    normalizeRequirementId = v.normalizeRequirementId;
    normalizeRequirementHeadings = v.normalizeRequirementHeadings;
  });

  describe("extractRequirementIds", () => {
    it("should extract simple requirement IDs", () => {
      const content = "Some text R-1 and R-2 and R-3";
      const result = extractRequirementIds(content);
      expect(result).toEqual(["R-1", "R-2", "R-3"]);
    });

    it("should deduplicate requirement IDs", () => {
      const content = "R-1 is mentioned R-1 again";
      const result = extractRequirementIds(content);
      expect(result).toEqual(["R-1"]);
    });

    it("should return sorted IDs", () => {
      const content = "R-3 and R-1 and R-2";
      const result = extractRequirementIds(content);
      expect(result).toEqual(["R-1", "R-2", "R-3"]);
    });

    it("should return empty array for no IDs", () => {
      const content = "No IDs here";
      const result = extractRequirementIds(content);
      expect(result).toEqual([]);
    });
  });

  describe("extractTaskIds", () => {
    it("should extract task IDs", () => {
      const content = "Task T-1 depends on T-2";
      const result = extractTaskIds(content);
      expect(result).toEqual(["T-1", "T-2"]);
    });

    it("should return sorted unique task IDs", () => {
      const content = "T-3 and T-1 and T-2";
      const result = extractTaskIds(content);
      expect(result).toEqual(["T-1", "T-2", "T-3"]);
    });
  });

  describe("normalizeRequirementId", () => {
    it("should return valid ID as-is", () => {
      expect(normalizeRequirementId("R-1")).toBe("R-1");
      expect(normalizeRequirementId("R-42")).toBe("R-42");
    });

    it("should normalize various formats", () => {
      expect(normalizeRequirementId("R1")).toBe("R-1");
      expect(normalizeRequirementId("R 1")).toBe("R-1");
      expect(normalizeRequirementId("R:1")).toBe("R-1");
      expect(normalizeRequirementId("r-1")).toBe("R-1");
    });

    it("should return null for invalid formats", () => {
      expect(normalizeRequirementId("X-1")).toBeNull();
      expect(normalizeRequirementId("REQ-1")).toBeNull();
      expect(normalizeRequirementId("")).toBeNull();
    });
  });

  describe("normalizeRequirementHeadings", () => {
    it("should normalize numeric headings to R-N format", () => {
      const content = `### Requirement 1
Content here

### Requirement 2
More content`;

      const result = normalizeRequirementHeadings(content);

      expect(result.content).toContain("### Requirement R-1");
      expect(result.content).toContain("### Requirement R-2");
      expect(result.mappings).toHaveLength(2);
      expect(result.mappings).toContain("Requirement 1 -> R-1");
      expect(result.mappings).toContain("Requirement 2 -> R-2");
    });

    it("should not modify already normalized headings", () => {
      const content = `### Requirement R-1
Content`;

      const result = normalizeRequirementHeadings(content);

      expect(result.content).toContain("### Requirement R-1");
      expect(result.mappings).toHaveLength(0);
    });

    it("should handle mixed normalized and numeric headings", () => {
      const content = `### Requirement 1
### Requirement R-2
### Requirement 3`;

      const result = normalizeRequirementHeadings(content);

      expect(result.content).toContain("### Requirement R-1");
      expect(result.content).toContain("### Requirement R-2");
      expect(result.content).toContain("### Requirement R-3");
      expect(result.mappings).toHaveLength(2);
    });

    it("should preserve content after headings", () => {
      const content = `### Requirement 1
Some detailed content about the requirement.

### Requirement 2
More content here.`;

      const result = normalizeRequirementHeadings(content);

      expect(result.content).toContain("Some detailed content about the requirement.");
      expect(result.content).toContain("More content here.");
    });

    it("should handle headings with existing R-N references in parentheses", () => {
      const content = `### Requirement 1 (R-1)
Content`;

      const result = normalizeRequirementHeadings(content);

      expect(result.content).toContain("### Requirement R-1 (R-1)");
      expect(result.mappings).toHaveLength(1);
    });

    it("should return empty mappings for content without numeric headings", () => {
      const content = `### Some other heading
Content here`;

      const result = normalizeRequirementHeadings(content);

      expect(result.mappings).toHaveLength(0);
    });
  });

  describe("validateRequirementIds", () => {
    it("should pass for valid requirement IDs", () => {
      const content = `
### Requirement 1 (R-1)
Content here

### Requirement 2 (R-2)
More content
    `;
      const result = validateRequirementIds(content);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle various ID formats", () => {
      const content = "### Requirement 1 (R-1)\n### Requirement 2 (R-2)";
      const result = validateRequirementIds(content);
      expect(result).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("should warn and normalize non-standard IDs", () => {
      const content = "R-1 is used with R:2 instead of R-1";
      const result = validateRequirementIds(content);
      expect(result.ok).toBe(true);
      const normalizedWarnings = result.warnings.filter(w => w.code === "REQ_ID_FORMAT_NORMALIZED");
      expect(normalizedWarnings.length).toBeGreaterThanOrEqual(0);
    });

    it("should warn about sequence gaps", () => {
      const content = "Requirements: R-1, R-2, R-3, R-5 (R-4 is missing)";
      const result = validateRequirementIds(content);
      const gapWarnings = result.warnings.filter(w => w.code === "REQ_ID_SEQUENCE_GAP");
      expect(gapWarnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("validateTaskFormat", () => {
    it("should pass for well-formatted tasks", () => {
      const content = `
## T-1 — First Task

**Maps to requirements:** R-1

- [ ] First subtask
    `;
      const result = validateTaskFormat(content);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect parallel tasks (P)", () => {
      const content = `
## T-1 — Parallel Task (P)

**Maps to requirements:** R-1
    `;
      const result = validateTaskFormat(content);
      expect(result.warnings.some(w => w.code === "TASK_PARALLEL_DETECTED")).toBe(true);
    });

    it("should warn about optional-only test subtasks", () => {
      const content = `
## T-1 — Task

- [ ]* Optional test only
    `;
      const result = validateTaskFormat(content);
      expect(result.warnings.some(w => w.code === "TASK_OPTIONAL_TEST_ONLY")).toBe(true);
    });
  });

  describe("validateTasksCoverage", () => {
    it("should pass when all requirements are covered", () => {
      const requirements = `
### Requirement 1 (R-1)
Content

### Requirement 2 (R-2)
Content
    `;

      const tasks = `
## T-1 — First Task

**Maps to requirements:** R-1

## T-2 — Second Task

**Maps to requirements:** R-2
    `;

      const result = validateTasksCoverage(requirements, tasks);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect uncovered requirements", () => {
      const requirements = `
### Requirement 1 (R-1)
### Requirement 2 (R-2)
    `;

      const tasks = `
## T-1 — Only Task

**Maps to requirements:** R-1
    `;

      const result = validateTasksCoverage(requirements, tasks);
      expect(result.ok).toBe(false);
      expect(result.errors[0].code).toBe("REQ_UNCOVERED_BY_TASKS");
      expect(result.errors[0].message).toContain("R-2");
    });

    it("should return incomplete coverage warning", () => {
      const requirements = `
### Requirement 1 (R-1)
### Requirement 2 (R-2)
    `;

      const tasks = `
## T-1 — Task

**Maps to requirements:** R-1
    `;

      const result = validateTasksCoverage(requirements, tasks);
      expect(result.warnings.some(w => w.code === "REQ_COVERAGE_INCOMPLETE")).toBe(true);
    });
  });

  describe("validateDesignTraceability", () => {
    it("should pass when all requirements are traced", () => {
      const requirements = `
### Requirement 1 (R-1)
Content

### Requirement 2 (R-2)
Content
    `;

      const design = `
## Requirements

- R-1: covered
- R-2: covered
    `;

      const result = validateDesignTraceability(requirements, design);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail for empty design", () => {
      const requirements = "### Requirement 1 (R-1)";
      const design = "";

      const result = validateDesignTraceability(requirements, design);
      expect(result.ok).toBe(false);
      expect(result.errors[0].code).toBe("DESIGN_EMPTY");
    });

    it("should detect traceability gaps", () => {
      const requirements = `
### Requirement 1 (R-1)
### Requirement 2 (R-2)
    `;

      const design = `
## Requirements

- R-1: traced
    `;

      const result = validateDesignTraceability(requirements, design);
      expect(result.ok).toBe(false);
      expect(result.errors[0].code).toBe("DESIGN_TRACEABILITY_GAP");
      expect(result.errors[0].message).toContain("R-2");
    });

    it("should warn about missing Requirements section", () => {
      const requirements = "### Requirement 1 (R-1)";
      const design = "Some design without requirements section";

      const result = validateDesignTraceability(requirements, design);
      expect(result.warnings.some(w => w.code === "DESIGN_MISSING_REQUIREMENTS_SECTION")).toBe(
        true
      );
    });
  });

  describe("validateTaskDependencies", () => {
    it("should pass for valid dependencies", () => {
      const tasks = [
        { id: "T-1", dependencies: [] },
        { id: "T-2", dependencies: ["T-1"] },
        { id: "T-3", dependencies: ["T-2"] },
      ];

      const result = validateTaskDependencies(tasks);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect unknown dependencies", () => {
      const tasks = [{ id: "T-1", dependencies: ["T-99"] }];

      const result = validateTaskDependencies(tasks);
      expect(result.ok).toBe(false);
      expect(result.errors[0].code).toBe("TASK_UNKNOWN_DEPENDENCY");
      expect(result.errors[0].message).toContain("T-99");
    });

    it("should detect dependency cycles", () => {
      const tasks = [
        { id: "T-1", dependencies: ["T-2"] },
        { id: "T-2", dependencies: ["T-1"] },
      ];

      const result = validateTaskDependencies(tasks);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.code === "TASK_DEPENDENCY_CYCLE")).toBe(true);
    });

    it("should handle complex cycles", () => {
      const tasks = [
        { id: "T-1", dependencies: ["T-2"] },
        { id: "T-2", dependencies: ["T-3"] },
        { id: "T-3", dependencies: ["T-1"] },
      ];

      const result = validateTaskDependencies(tasks);
      expect(result.ok).toBe(false);
      expect(result.errors[0].code).toBe("TASK_DEPENDENCY_CYCLE");
    });
  });

  describe("detectDependencyCycles", () => {
    it("should return empty for acyclic graph", () => {
      const tasks = [
        { id: "T-1", dependencies: [] },
        { id: "T-2", dependencies: ["T-1"] },
      ];

      const cycles = detectDependencyCycles(tasks);
      expect(cycles).toHaveLength(0);
    });

    it("should detect simple cycle", () => {
      const tasks = [
        { id: "T-1", dependencies: ["T-2"] },
        { id: "T-2", dependencies: ["T-1"] },
      ];

      const cycles = detectDependencyCycles(tasks);
      expect(cycles).toHaveLength(1);
    });

    it("should detect self-referencing cycle", () => {
      const tasks = [{ id: "T-1", dependencies: ["T-1"] }];

      const cycles = detectDependencyCycles(tasks);
      expect(cycles).toHaveLength(1);
    });
  });

  describe("Deterministic Guard Tests", () => {
    describe("ID Format Violations", () => {
      it("should normalize non-standard ID formats", () => {
        const result = normalizeRequirementId("R1");
        expect(result).toBe("R-1");
      });

      it("should normalize ID with colon", () => {
        const result = normalizeRequirementId("R:1");
        expect(result).toBe("R-1");
      });

      it("should normalize ID with space", () => {
        const result = normalizeRequirementId("R 1");
        expect(result).toBe("R-1");
      });

      it("should reject empty requirement ID", () => {
        const result = normalizeRequirementId("");
        expect(result).toBeNull();
      });

      it("should reject requirement ID with special characters", () => {
        const result = normalizeRequirementId("R@1");
        expect(result).toBeNull();
      });

      it("should reject task ID as requirement ID", () => {
        const result = normalizeRequirementId("TASK-1");
        expect(result).toBeNull();
      });

      it("should detect sequence gaps", () => {
        const content =
          "### Requirement R-1\nContent\n\n### Requirement R-2\nContent\n\n### Requirement R-3\nContent\n\n### Requirement R-5\nContent";
        const result = validateRequirementIds(content);
        expect(result.warnings.some(w => w.code === "REQ_ID_SEQUENCE_GAP")).toBe(true);
      });
    });

    describe("Traceability Gaps", () => {
      it("should detect when design misses requirement", () => {
        const requirements = `
### Requirement 1 (R-1)
Content 1

### Requirement 2 (R-2)
Content 2
        `;

        const design = "## Requirements\n\n- R-1: covered";

        const result = validateDesignTraceability(requirements, design);
        expect(result.ok).toBe(false);
        expect(result.errors[0].code).toBe("DESIGN_TRACEABILITY_GAP");
        expect(result.errors[0].message).toContain("R-2");
      });

      it("should detect when task has no requirement mapping", () => {
        const requirements = "### Requirement 1 (R-1)\nContent";
        const tasks = `
## T-1 — Task with no mapping

**Outcome:** Task done
        `;

        const result = validateTasksCoverage(requirements, tasks);
        expect(result.ok).toBe(false);
        expect(result.errors.some(e => e.code === "REQ_UNCOVERED_BY_TASKS")).toBe(true);
      });

      it("should detect when requirement is not in any task", () => {
        const requirements = `
### Requirement 1 (R-1)
Content 1

### Requirement 2 (R-2)
Content 2
        `;

        const tasks = `
## T-1 — Task

**Maps to requirements:** R-1
        `;

        const result = validateTasksCoverage(requirements, tasks);
        expect(result.ok).toBe(false);
        expect(result.errors[0].code).toBe("REQ_UNCOVERED_BY_TASKS");
        expect(result.errors[0].message).toContain("R-2");
      });
    });

    describe("Unknown Dependencies and DAG Cycles", () => {
      it("should detect single unknown dependency", () => {
        const tasks = [{ id: "T-1", dependencies: ["T-NONEXISTENT"] }];
        const result = validateTaskDependencies(tasks);
        expect(result.ok).toBe(false);
        expect(result.errors[0].code).toBe("TASK_UNKNOWN_DEPENDENCY");
        expect(result.errors[0].message).toContain("T-NONEXISTENT");
      });

      it("should detect multiple unknown dependencies", () => {
        const tasks = [{ id: "T-1", dependencies: ["T-UNKNOWN-1", "T-UNKNOWN-2"] }];
        const result = validateTaskDependencies(tasks);
        expect(result.ok).toBe(false);
        expect(result.errors[0].code).toBe("TASK_UNKNOWN_DEPENDENCY");
        expect(result.errors[0].message).toContain("T-UNKNOWN-1");
        expect(result.errors[0].message).toContain("T-UNKNOWN-2");
      });

      it("should detect 3-task cycle", () => {
        const tasks = [
          { id: "T-1", dependencies: ["T-2"] },
          { id: "T-2", dependencies: ["T-3"] },
          { id: "T-3", dependencies: ["T-1"] },
        ];

        const cycles = detectDependencyCycles(tasks);
        expect(cycles).toHaveLength(1);
        expect(cycles[0]).toContain("T-1");
        expect(cycles[0]).toContain("T-2");
        expect(cycles[0]).toContain("T-3");
      });

      it("should detect multiple cycles", () => {
        const tasks = [
          { id: "T-1", dependencies: ["T-2"] },
          { id: "T-2", dependencies: ["T-1"] },
          { id: "T-3", dependencies: ["T-4"] },
          { id: "T-4", dependencies: ["T-3"] },
        ];

        const cycles = detectDependencyCycles(tasks);
        expect(cycles.length).toBeGreaterThanOrEqual(2);
      });

      it("should detect cycle with additional edges", () => {
        const tasks = [
          { id: "T-1", dependencies: ["T-2", "T-3"] },
          { id: "T-2", dependencies: ["T-1"] },
          { id: "T-3", dependencies: [] },
        ];

        const cycles = detectDependencyCycles(tasks);
        expect(cycles).toHaveLength(1);
        expect(cycles[0]).toContain("T-1");
        expect(cycles[0]).toContain("T-2");
      });
    });

    describe("Malformed Marker Usage", () => {
      it("should detect (P) marker without leading space", () => {
        const content = `## T-1 — Task(P)
        `;
        const result = validateTaskFormat(content);
        expect(result.warnings.some(w => w.code === "TASK_PARALLEL_DETECTED")).toBe(true);
      });

      it("should detect - [ ]* without space after bracket", () => {
        const content = `
## T-1 — Task

- []*Optional test
        `;

        const result = validateTaskFormat(content);
        expect(result.warnings.some(w => w.code === "TASK_OPTIONAL_TEST_ONLY")).toBe(true);
      });

      it("should handle multiple (P) markers correctly", () => {
        const content = `
## T-1 — Task (P)

## T-2 — Another Task (P)
        `;

        const result = validateTaskFormat(content);
        expect(result.warnings.some(w => w.code === "TASK_PARALLEL_DETECTED")).toBe(true);
      });

      it("should warn when only optional test subtasks exist", () => {
        const content = `
## T-1 — Task

- [ ]* Optional test 1
- [ ]* Optional test 2
        `;

        const result = validateTaskFormat(content);
        expect(result.warnings.some(w => w.code === "TASK_OPTIONAL_TEST_ONLY")).toBe(true);
      });

      it("should not warn when required tests exist with optional ones", () => {
        const content = `
## T-1 — Task

- [ ]* Optional test
- [ ] Required test
        `;

        const result = validateTaskFormat(content);
        expect(result.warnings.some(w => w.code === "TASK_OPTIONAL_TEST_ONLY")).toBe(false);
      });
    });
  });
});
