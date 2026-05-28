/** Offline mode: agents return canned responses instead of calling the API. */
export function shouldMockAI(): boolean {
  return process.env.MOCK_AI === "true";
}

/**
 * Maps an Anthropic SDK / fetch error to a clear, user-facing reason.
 * Avoids the misleading "check your API key" catch-all when the real
 * cause is billing, rate limits, or something else.
 */
export function aiErrorMessage(err: unknown): string {
  const e = err as {
    status?: number;
    message?: string;
    error?: { error?: { message?: string } };
  };
  const apiMessage = e?.error?.error?.message ?? e?.message ?? "";

  if (/credit balance is too low/i.test(apiMessage)) {
    return "AI is unavailable: the Anthropic account is out of credits. Add credits in the Anthropic console (Plans & Billing), or set MOCK_AI=true for offline mock responses.";
  }
  if (
    e?.status === 401 ||
    /invalid x-api-key|authentication_error|could not resolve authentication|api key not valid|api_key_invalid|invalid api key/i.test(
      apiMessage
    )
  ) {
    return "AI is unavailable: the API key is missing or invalid. Check ANTHROPIC_API_KEY / GEMINI_API_KEY / GROQ_API_KEY (and AI_PROVIDER) in your environment.";
  }
  if (e?.status === 429 || /rate limit|quota|resource_exhausted/i.test(apiMessage)) {
    return "AI is temporarily rate-limited or out of quota. Please wait a moment and try again.";
  }
  if (
    e?.status === 503 ||
    e?.status === 500 ||
    /high demand|overloaded|unavailable|try again later/i.test(apiMessage)
  ) {
    return "The AI model is busy right now (high demand). Please try again in a moment.";
  }
  if (apiMessage) {
    return `AI request failed: ${apiMessage}`;
  }
  return "AI request failed unexpectedly. Please try again.";
}
