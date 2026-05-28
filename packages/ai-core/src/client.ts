import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  smart: "claude-sonnet-4-6",
  powerful: "claude-opus-4-7",
} as const;

// gemini-2.5-flash works on the free tier. gemini-2.5-pro / gemini-2.0-flash
// require a paid plan (free-tier quota is 0) — swap once billing is enabled.
export const GEMINI_MODELS = {
  fast: "gemini-2.5-flash",
  smart: "gemini-2.5-flash",
} as const;

export const GROQ_MODELS = {
  fast: "llama-3.1-8b-instant",
  smart: "llama-3.3-70b-versatile",
} as const;

export const SYSTEM_PROMPT_BASE = `You are SecondBrain AI — a personal life coach and intelligent assistant embedded in the user's SecondBrain app.

Your role is to help the user:
- Build and maintain healthy habits
- Advance their career with clear goals and skills
- Gain insights from their data
- Stay motivated and accountable

Tone: warm, encouraging, concise, and data-driven. Use the user's actual data to give personalized insights. Never be generic. Always reference specifics from their context.`;
