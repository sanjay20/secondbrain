import { anthropic } from "./client";

export type AIProvider = "anthropic" | "gemini" | "groq";

export interface ChatConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
}

/** A prior conversation turn to resend to the model for multi-turn context. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const JSON_HEADERS = { "content-type": "application/json" } as const;

class ProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

// Providers intermittently return 5xx ("high demand") under load — retry those
// transient failures with backoff before surfacing an error.
const RETRY_STATUS = new Set([500, 502, 503]);

async function postWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<Response> {
  let res!: Response;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { method: "POST", headers, body });
    if (res.ok || !RETRY_STATUS.has(res.status) || attempt === 2) return res;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  return res;
}

/**
 * Completion through the configured provider. Pass `history` (prior turns,
 * oldest-first, excluding the current prompt) for multi-turn context.
 */
export async function chat(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[] = []
): Promise<string> {
  switch (cfg.provider) {
    case "gemini":
      return geminiChat(cfg, system, prompt, history);
    case "groq":
      return groqChat(cfg, system, prompt, history);
    default:
      return anthropicChat(cfg, system, prompt, history);
  }
}

/** Streaming completion through the configured provider. */
export async function* streamChat(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[] = []
): AsyncGenerator<string> {
  switch (cfg.provider) {
    case "gemini":
      yield* geminiStream(cfg, system, prompt, history);
      break;
    case "groq":
      yield* groqStream(cfg, system, prompt, history);
      break;
    default:
      yield* anthropicStream(cfg, system, prompt, history);
  }
}

// ---------- Anthropic ----------

async function anthropicChat(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[]
): Promise<string> {
  const message = await anthropic.messages.create({
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    system,
    messages: [...history, { role: "user", content: prompt }],
  });
  return (message.content[0] as { type: string; text: string }).text;
}

async function* anthropicStream(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[]
): AsyncGenerator<string> {
  const stream = await anthropic.messages.create({
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    stream: true,
    system,
    messages: [...history, { role: "user", content: prompt }],
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

// ---------- Gemini ----------

function geminiKey(): string {
  return process.env.GEMINI_API_KEY ?? "";
}

function geminiBody(system: string, prompt: string, maxTokens: number, history: ChatTurn[]): string {
  const priorContents = history.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [...priorContents, { role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  });
}

function geminiText(data: unknown): string {
  const parts =
    (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      ?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

async function geminiError(res: Response): Promise<ProviderError> {
  let message = `Gemini request failed (HTTP ${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) message = body.error.message;
  } catch {
    // non-JSON error body
  }
  return new ProviderError(message, res.status);
}

async function geminiChat(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[]
): Promise<string> {
  const res = await postWithRetry(
    `${GEMINI_BASE}/${cfg.model}:generateContent?key=${geminiKey()}`,
    JSON_HEADERS,
    geminiBody(system, prompt, cfg.maxTokens, history)
  );
  if (!res.ok) throw await geminiError(res);
  return geminiText(await res.json());
}

async function* geminiStream(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[]
): AsyncGenerator<string> {
  const res = await postWithRetry(
    `${GEMINI_BASE}/${cfg.model}:streamGenerateContent?alt=sse&key=${geminiKey()}`,
    JSON_HEADERS,
    geminiBody(system, prompt, cfg.maxTokens, history)
  );
  if (!res.ok || !res.body) throw await geminiError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const text = geminiText(JSON.parse(json));
        if (text) yield text;
      } catch {
        // partial SSE chunk; wait for more data
      }
    }
  }
}

// ---------- Groq (OpenAI-compatible) ----------

function groqHeaders(): Record<string, string> {
  return { ...JSON_HEADERS, authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}` };
}

function groqBody(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  stream: boolean,
  history: ChatTurn[]
): string {
  return JSON.stringify({
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    stream,
    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: prompt },
    ],
  });
}

async function groqError(res: Response): Promise<ProviderError> {
  let message = `Groq request failed (HTTP ${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) message = body.error.message;
  } catch {
    // non-JSON error body
  }
  return new ProviderError(message, res.status);
}

async function groqChat(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[]
): Promise<string> {
  const res = await postWithRetry(GROQ_URL, groqHeaders(), groqBody(cfg, system, prompt, false, history));
  if (!res.ok) throw await groqError(res);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data?.choices?.[0]?.message?.content ?? "";
}

async function* groqStream(
  cfg: ChatConfig,
  system: string,
  prompt: string,
  history: ChatTurn[]
): AsyncGenerator<string> {
  const res = await postWithRetry(GROQ_URL, groqHeaders(), groqBody(cfg, system, prompt, true, history));
  if (!res.ok || !res.body) throw await groqError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const data = JSON.parse(json) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const text = data?.choices?.[0]?.delta?.content ?? "";
        if (text) yield text;
      } catch {
        // partial SSE chunk; wait for more data
      }
    }
  }
}
