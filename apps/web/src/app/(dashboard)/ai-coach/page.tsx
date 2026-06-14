"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CoachAction {
  type: "habit" | "goal" | "skill";
  name?: string;
  title?: string;
  area?: string;
  category?: string;
  frequency?: string;
  priority?: string;
  level?: number;
  description?: string;
}

interface ActionResult {
  ok: number;
  total: number;
  labels: string[];
  destination: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  actionResult?: ActionResult;
}

// Put each sentence on its own line for easier reading. Preserves existing line
// breaks and avoids splitting on list markers / decimals (e.g. "1." or "3.5").
function oneSentencePerLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/(?<![0-9])([.!?])\s+(?=\S)/g, "$1\n"))
    .join("\n");
}

// The coach appends a machine-readable action block when asked to add items.
// Split it out so we can hide the raw JSON and execute the actions.
const ACTION_START = "<<<ACTIONS>>>";
const ACTION_END = "<<<END_ACTIONS>>>";

function parseActions(content: string): { text: string; actions: CoachAction[] | null } {
  const start = content.indexOf(ACTION_START);
  if (start === -1) return { text: content, actions: null };

  const end = content.indexOf(ACTION_END, start);
  const jsonStr = end === -1 ? content.slice(start + ACTION_START.length) : content.slice(start + ACTION_START.length, end);
  const text = (content.slice(0, start) + (end === -1 ? "" : content.slice(end + ACTION_END.length))).trim();

  let actions: CoachAction[] | null = null;
  try {
    const parsed = JSON.parse(jsonStr.trim()) as { actions?: CoachAction[] };
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) actions = parsed.actions;
  } catch {
    // block not fully streamed / invalid JSON
  }
  return { text, actions };
}

const TYPE_DESTINATION: Record<CoachAction["type"], string> = {
  habit: "Habits",
  goal: "Career / Knowledge",
  skill: "Career / Knowledge",
};

async function runAction(a: CoachAction): Promise<boolean> {
  let res: Response;
  if (a.type === "habit") {
    res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: a.name ?? a.title,
        category: a.category ?? "general",
        frequency: a.frequency ?? "daily",
        ...(a.description ? { description: a.description } : {}),
      }),
    });
  } else if (a.type === "goal") {
    res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: a.title ?? a.name,
        area: a.area ?? "career",
        category: a.category ?? (a.area === "knowledge" ? "technical" : "career"),
        priority: a.priority ?? "medium",
        ...(a.description ? { description: a.description } : {}),
      }),
    });
  } else if (a.type === "skill") {
    res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: a.name ?? a.title,
        area: a.area ?? "career",
        category: a.category ?? "technical",
        level: a.level ?? 1,
      }),
    });
  } else {
    return false;
  }
  return res.ok;
}

const SUGGESTED_PROMPTS = [
  "Suggest 5 habits to improve my diet, then add them",
  "What should I focus on today based on my habits?",
  "Help me break down my top career goal into steps",
  "Give me 3 learning goals for personal finance and add them",
  "Create a weekly plan to improve my health habits",
];

export default function AICoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your SecondBrain AI Coach. I have access to your habits, goals, and skills to give you personalized guidance — and I can add habits, goals, and skills for you when you ask. What would you like to work on today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string) {
    if (!content.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content.trim() }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }

      const { actions } = parseActions(full);
      if (actions) await executeActions(actions);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "Sorry, I couldn't reach the AI service. Please check your connection and try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function executeActions(actions: CoachAction[]) {
    const labels: string[] = [];
    let ok = 0;
    for (const a of actions) {
      try {
        if (await runAction(a)) {
          ok++;
          labels.push(a.title ?? a.name ?? a.type);
        }
      } catch {
        // skip failed item
      }
    }

    const destinations = [...new Set(actions.map((a) => TYPE_DESTINATION[a.type]).filter(Boolean))];
    const result: ActionResult = {
      ok,
      total: actions.length,
      labels,
      destination: destinations.join(" & ") || "your app",
    };

    setMessages((prev) => {
      const updated = [...prev];
      const last = updated.length - 1;
      updated[last] = { ...updated[last], actionResult: result };
      return updated;
    });

    if (ok > 0) toast.success(`Added ${ok} ${ok === 1 ? "item" : "items"} to ${result.destination}`);
    if (ok < actions.length) toast.error(`${actions.length - ok} item(s) could not be added`);
  }

  return (
    <div className="flex flex-col flex-1 h-screen">
      <Header title="AI Coach" subtitle="Your personal AI-powered life coach" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3 animate-fade-in", msg.role === "user" && "flex-row-reverse")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              msg.role === "assistant" ? "bg-violet-400/20" : "bg-blue-400/20"
            )}>
              {msg.role === "assistant"
                ? <Bot className="w-4 h-4 text-violet-400" />
                : <User className="w-4 h-4 text-blue-400" />
              }
            </div>
            <div className={cn(
              "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line",
              msg.role === "assistant"
                ? "bg-card border border-border text-foreground rounded-tl-sm"
                : "bg-primary text-primary-foreground rounded-tr-sm"
            )}>
              {msg.role === "assistant"
                ? oneSentencePerLine(parseActions(msg.content).text)
                : msg.content}
              {!msg.content && streaming && i === messages.length - 1 && (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              )}
              {msg.actionResult && (
                <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 not-prose">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {msg.actionResult.ok > 0
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    <span>{msg.actionResult.ok} of {msg.actionResult.total} added to {msg.actionResult.destination}</span>
                  </div>
                  {msg.actionResult.labels.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {msg.actionResult.labels.map((label, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border space-y-3">
        {messages.length <= 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors border border-border"
              >
                <Sparkles className="w-3 h-3 text-violet-400" />
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask your AI coach anything..."
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            disabled={streaming}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
