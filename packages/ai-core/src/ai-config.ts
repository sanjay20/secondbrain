import { MODELS } from "./client";

/**
 * Per-feature model assignments.
 * Change any value to MODELS.fast | MODELS.smart | MODELS.powerful
 * to trade off cost vs. quality for that feature.
 *
 * Cost reference (per call, approximate):
 *   MODELS.fast    (Haiku)  ~$0.001
 *   MODELS.smart   (Sonnet) ~$0.007–0.011
 *   MODELS.powerful (Opus)  ~$0.05+
 */
export const AI_CONFIG = {
  briefing: {
    model: MODELS.fast,   // Change to MODELS.smart for higher quality
    maxTokens: 600,
  },
  healthInsight: {
    model: MODELS.fast,
    maxTokens: 400,
  },
  habitSuggestion: {
    model: MODELS.fast,
    maxTokens: 300,
  },
  careerInsight: {
    model: MODELS.fast,
    maxTokens: 400,
  },
  careerCoach: {
    model: MODELS.smart,  // Keep Sonnet for interactive chat quality
    maxTokens: 800,
  },
} as const;
