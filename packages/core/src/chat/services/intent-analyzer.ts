/**
 * Intent Analyzer
 *
 * Configurable intent detection for proactive spec wizard offers.
 */

/**
 * Intent kind
 */
export type IntentKind = "feature_request" | "other";

/**
 * Intent analysis result
 */
export interface IntentResult {
  kind: IntentKind;
  confidence: number;
}

/**
 * Intent policy configuration
 */
export interface IntentPolicy {
  /** Whether intent detection is enabled */
  enabled: boolean;
  /** Confidence threshold for offering wizard (0-1) */
  threshold: number;
  /** Custom patterns for feature request detection */
  patterns: string[];
}

/**
 * Default feature request patterns
 */
const DEFAULT_FEATURE_PATTERNS = [
  // Build/create keywords
  /\b(build|create|implement|develop|add|new feature|build a feature|create a feature)\b/i,
  // Spec-related keywords
  /\b(spec|specification|requirements|design|tasks?|spec for|create a spec)\b/i,
  // Feature request patterns
  /\b(feature request|new feature|develop a feature|add a feature)\b/i,
];

/**
 * Non-feature patterns (exclusions)
 */
const EXCLUSION_PATTERNS = [
  // Questions
  /^\s*(how|what|why|when|where|who|which|explain|tell me)\b/i,
  // Bug reports
  /\b(bug|fix|error|broken|not working|debug|issue)\b/i,
  // Explorations
  /\b(explore|look at|find|search|show me|what's in|tell me about)\b/i,
];

/**
 * Analyze message intent
 * @param message - User message to analyze
 * @returns Intent result with kind and confidence
 */
export function analyzeIntent(message: string): IntentResult {
  if (!message || message.trim().length === 0) {
    return { kind: "other", confidence: 0 };
  }

  const normalized = message.trim().toLowerCase();

  // Check exclusions first
  for (const pattern of EXCLUSION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: "other", confidence: 0.2 };
    }
  }

  // Check feature request patterns
  let matchCount = 0;
  for (const pattern of DEFAULT_FEATURE_PATTERNS) {
    if (pattern.test(normalized)) {
      matchCount++;
    }
  }

  // Calculate confidence based on pattern matches
  const confidence = matchCount > 0 ? Math.min(0.5 + matchCount * 0.15, 0.95) : 0.1;

  return {
    kind: confidence > 0.5 ? "feature_request" : "other",
    confidence,
  };
}

/**
 * Check if wizard should be offered based on result and policy
 * @param result - Intent analysis result
 * @param policy - Intent policy configuration
 * @returns Whether to offer wizard
 */
export function shouldOfferWizard(result: IntentResult, policy: IntentPolicy): boolean {
  if (!policy.enabled) {
    return false;
  }

  if (result.kind !== "feature_request") {
    return false;
  }

  return result.confidence >= policy.threshold;
}

/**
 * Intent analyzer interface
 */
export interface IntentAnalyzer {
  analyze(message: string): IntentResult;
  shouldOfferWizard(result: IntentResult): boolean;
  getPolicy(): IntentPolicy;
  setPolicy(policy: Partial<IntentPolicy>): void;
  recordFeedback(kind: IntentKind, confidence: number, wasCorrect: boolean): void;
  getFeedbackCount(): number;
}

/**
 * Create intent analyzer with policy
 * @param policy - Optional policy configuration
 * @returns Intent analyzer instance
 */
export function createIntentAnalyzer(policy?: Partial<IntentPolicy>): IntentAnalyzer {
  let currentPolicy: IntentPolicy = {
    enabled: policy?.enabled ?? true,
    threshold: policy?.threshold ?? 0.7,
    patterns: policy?.patterns ?? [],
  };

  const feedbackData: Array<{
    kind: IntentKind;
    confidence: number;
    wasCorrect: boolean;
    timestamp: number;
  }> = [];

  return {
    analyze: (message: string): IntentResult => {
      return analyzeIntent(message);
    },

    shouldOfferWizard: (result: IntentResult): boolean => {
      return shouldOfferWizard(result, currentPolicy);
    },

    getPolicy: (): IntentPolicy => {
      return { ...currentPolicy };
    },

    setPolicy: (updates: Partial<IntentPolicy>): void => {
      currentPolicy = { ...currentPolicy, ...updates };
    },

    recordFeedback: (kind: IntentKind, confidence: number, wasCorrect: boolean): void => {
      feedbackData.push({ kind, confidence, wasCorrect, timestamp: Date.now() });
    },

    getFeedbackCount: (): number => {
      return feedbackData.length;
    },
  };
}
