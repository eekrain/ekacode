/**
 * Intent Analyzer Tests
 *
 * Tests for intent detection with configurable policy.
 */

import { describe, expect, it } from "vitest";
import {
  analyzeIntent,
  createIntentAnalyzer,
  shouldOfferWizard,
  type IntentPolicy,
  type IntentResult,
} from "../intent-analyzer";

describe("IntentAnalyzer", () => {
  describe("analyzeIntent", () => {
    it("identifies feature request patterns", () => {
      const result = analyzeIntent("I need to build a new feature for user authentication");
      expect(result.kind).toBe("feature_request");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("identifies build-related keywords", () => {
      const result = analyzeIntent("Create a spec for authentication system");
      expect(result.kind).toBe("feature_request");
    });

    it("identifies spec creation requests", () => {
      const result = analyzeIntent("Help me create a specification for the API");
      expect(result.kind).toBe("feature_request");
    });

    it("returns other for question-like inputs", () => {
      const result = analyzeIntent("How does the parser work?");
      expect(result.kind).toBe("other");
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("returns other for exploration requests", () => {
      const result = analyzeIntent("Explore the codebase for patterns");
      expect(result.kind).toBe("other");
    });

    it("returns other for bug reports", () => {
      const result = analyzeIntent("Fix the broken authentication flow");
      expect(result.kind).toBe("other");
    });

    it("returns low confidence for ambiguous inputs", () => {
      const result = analyzeIntent("Maybe add something to the spec");
      expect(result.confidence).toBeLessThan(0.9);
    });

    it("handles empty or whitespace input", () => {
      const result = analyzeIntent("   ");
      expect(result.kind).toBe("other");
      expect(result.confidence).toBe(0);
    });
  });

  describe("shouldOfferWizard", () => {
    const defaultPolicy: IntentPolicy = {
      enabled: true,
      threshold: 0.7,
      patterns: [],
    };

    it("returns true for high-confidence feature requests", () => {
      const result: IntentResult = {
        kind: "feature_request",
        confidence: 0.9,
      };

      expect(shouldOfferWizard(result, defaultPolicy)).toBe(true);
    });

    it("returns false for low-confidence results", () => {
      const result: IntentResult = {
        kind: "feature_request",
        confidence: 0.5,
      };

      expect(shouldOfferWizard(result, defaultPolicy)).toBe(false);
    });

    it("returns false when policy is disabled", () => {
      const policy: IntentPolicy = { ...defaultPolicy, enabled: false };
      const result: IntentResult = {
        kind: "feature_request",
        confidence: 0.9,
      };

      expect(shouldOfferWizard(result, policy)).toBe(false);
    });

    it("respects custom threshold", () => {
      const policy: IntentPolicy = { ...defaultPolicy, threshold: 0.8 };
      const result: IntentResult = {
        kind: "feature_request",
        confidence: 0.75,
      };

      expect(shouldOfferWizard(result, policy)).toBe(false);
    });

    it("returns false for non-feature intents", () => {
      const result: IntentResult = {
        kind: "other",
        confidence: 0.9,
      };

      expect(shouldOfferWizard(result, defaultPolicy)).toBe(false);
    });
  });

  describe("createIntentAnalyzer", () => {
    it("creates analyzer with default policy", () => {
      const analyzer = createIntentAnalyzer();
      const policy = analyzer.getPolicy();

      expect(policy.enabled).toBe(true);
      expect(policy.threshold).toBe(0.7);
    });

    it("creates analyzer with custom policy", () => {
      const customPolicy: IntentPolicy = {
        enabled: false,
        threshold: 0.5,
        patterns: ["custom", "pattern"],
      };
      const analyzer = createIntentAnalyzer(customPolicy);
      const policy = analyzer.getPolicy();

      expect(policy).toEqual(customPolicy);
    });

    it("analyzes message using configured policy", () => {
      const analyzer = createIntentAnalyzer({ enabled: true, threshold: 0.6, patterns: [] });
      const result = analyzer.analyze("Create a spec for the feature");

      expect(result.kind).toBe("feature_request");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("evaluates offer based on configured policy", () => {
      const analyzer = createIntentAnalyzer({ enabled: true, threshold: 0.7, patterns: [] });
      const result = analyzer.analyze("Build a new feature for user authentication");

      expect(result.kind).toBe("feature_request");
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(analyzer.shouldOfferWizard(result)).toBe(true);
    });
  });

  describe("feedback capture", () => {
    it("records false positive feedback", () => {
      const analyzer = createIntentAnalyzer();
      analyzer.recordFeedback("feature_request", 0.9, false);

      // Should not throw
      expect(analyzer.getFeedbackCount()).toBeGreaterThan(0);
    });

    it("records false negative feedback", () => {
      const analyzer = createIntentAnalyzer();
      analyzer.recordFeedback("other", 0.8, true);

      expect(analyzer.getFeedbackCount()).toBeGreaterThan(0);
    });
  });
});
