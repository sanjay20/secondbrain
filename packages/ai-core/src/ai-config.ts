import { MODELS, GEMINI_MODELS, GROQ_MODELS } from "./client";
import type { AIProvider, ChatConfig } from "./provider";

/**
 * Active AI provider. Flip with the AI_PROVIDER env var:
 *   AI_PROVIDER=gemini      (default)
 *   AI_PROVIDER=anthropic
 *   AI_PROVIDER=groq
 */
export const AI_PROVIDER: AIProvider =
  process.env.AI_PROVIDER === "anthropic" || process.env.AI_PROVIDER === "groq"
    ? process.env.AI_PROVIDER
    : "gemini";

export type AIFeature =
  | "briefing"
  | "healthInsight"
  | "habitSuggestion"
  | "careerInsight"
  | "careerCoach";

/**
 * Per-feature settings. Each feature lists the model to use for every provider
 * plus its token budget, so switching AI_PROVIDER picks the right model
 * automatically. Edit a model name here to trade off cost vs. quality.
 *
 * Cost reference (per call, approximate):
 *   MODELS.fast / GEMINI_MODELS.fast    ~cheap
 *   MODELS.smart / GEMINI_MODELS.smart  ~higher quality
 */
const FEATURES: Record<
  AIFeature,
  { anthropic: string; gemini: string; groq: string; maxTokens: number }
> = {
  briefing: { anthropic: MODELS.fast, gemini: GEMINI_MODELS.fast, groq: GROQ_MODELS.fast, maxTokens: 600 },
  healthInsight: { anthropic: MODELS.fast, gemini: GEMINI_MODELS.fast, groq: GROQ_MODELS.fast, maxTokens: 400 },
  habitSuggestion: { anthropic: MODELS.fast, gemini: GEMINI_MODELS.fast, groq: GROQ_MODELS.fast, maxTokens: 300 },
  careerInsight: { anthropic: MODELS.fast, gemini: GEMINI_MODELS.fast, groq: GROQ_MODELS.fast, maxTokens: 400 },
  careerCoach: { anthropic: MODELS.smart, gemini: GEMINI_MODELS.smart, groq: GROQ_MODELS.smart, maxTokens: 800 },
};

/** Resolve the provider + model + token budget for a feature. */
export function getChatConfig(feature: AIFeature): ChatConfig {
  const f = FEATURES[feature];
  return { provider: AI_PROVIDER, model: f[AI_PROVIDER], maxTokens: f.maxTokens };
}
