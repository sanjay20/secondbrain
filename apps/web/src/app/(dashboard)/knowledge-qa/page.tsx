"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, StickyNote, BookOpen, Library } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Source {
  type: "note" | "highlight";
  id: string;
  title?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Put each sentence on its own line for easier reading. Preserves existing line
// breaks and avoids splitting on list markers / decimals (e.g. "1." or "3.5").
function oneSentencePerLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/(?<![0-9])([.!?])\s+(?=\S)/g, "$1\n"))
    .join("\n");
}

// The agent appends a machine-readable sources block citing the notes/highlights
// it drew on. Split it out so we can hide the raw JSON and render a Sources list.
const SOURCES_START = "<<<SOURCES>>>";
const SOURCES_END = "<<<END_SOURCES>>>";

function parseSources(content: string): { text: string; sources: Source[] } {
  const start = content.indexOf(SOURCES_START);
  if (start === -1) return { text: content, sources: [] };

  const end = content.indexOf(SOURCES_END, start);
  const jsonStr =
    end === -1
      ? content.slice(start + SOURCES_START.length)
      : content.slice(start + SOURCES_START.length, end);
  const text = (content.slice(0, start) + (end === -1 ? "" : content.slice(end + SOURCES_END.length))).trim();

  let sources: Source[] = [];
  try {
    const parsed = JSON.parse(jsonStr.trim()) as { sources?: Source[] };
    if (Array.isArray(parsed.sources)) sources = parsed.sources;
  } catch {
    // block not fully streamed / invalid JSON — degrade to "answer shown, no source list"
  }
  return { text, sources };
}

const SUGGESTED_PROMPTS = [
  "What have I saved about productivity?",
  "Summarize the key ideas in my highlights",
  "What did I note recently about my goals?",
  "Find my saved notes related to learning",
  "What have I highlighted about focus?",
];

export default function KnowledgeQAPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Ask me anything about your saved notes and highlights. I answer only from what you've saved — and I'll cite the specific notes and highlights I used.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasKnowledge, setHasKnowledge] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hydrate the most recent conversation + knowledge availability on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/knowledge-qa");
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversationId: string | null;
          messages: Array<{ role: "user" | "assistant"; content: string }>;
          hasKnowledge: boolean;
        };
        if (cancelled) return;
        setHasKnowledge(data.hasKnowledge);
        if (data.conversationId && data.messages.length > 0) {
          setConversationId(data.conversationId);
          setMessages(data.messages);
        }
      } catch {
        // offline / not signed in — keep the default greeting
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMessage(content: string) {
    if (!content.trim() || streaming || hasKnowledge === false) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch("/api/ai/knowledge-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content.trim(), conversationId }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      if (!res.body) throw new Error("No response body");

      const convId = res.headers.get("X-Conversation-Id");
      if (convId) setConversationId(convId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
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

  const composerDisabled = streaming || hasKnowledge === false;

  return (
    <div className="flex flex-col flex-1 h-screen">
      <Header title="Knowledge Q&A" subtitle="Ask questions about your saved notes and highlights" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {hasKnowledge === false ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-pink-400/15 flex items-center justify-center">
              <Library className="w-7 h-7 text-pink-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">Save some notes or highlights first</h2>
              <p className="text-sm text-muted-foreground">
                Knowledge Q&A answers only from your own saved content. Capture a few notes or save
                some highlights, then come back and ask me anything about them.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/notes">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <StickyNote className="w-4 h-4 text-amber-400" />
                  Add a note
                </Button>
              </Link>
              <Link href="/knowledge">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BookOpen className="w-4 h-4 text-pink-400" />
                  Save a highlight
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const parsed = msg.role === "assistant" ? parseSources(msg.content) : null;
              return (
                <div key={i} className={cn("flex gap-3 animate-fade-in", msg.role === "user" && "flex-row-reverse")}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    msg.role === "assistant" ? "bg-pink-400/20" : "bg-blue-400/20"
                  )}>
                    {msg.role === "assistant"
                      ? <Bot className="w-4 h-4 text-pink-400" />
                      : <User className="w-4 h-4 text-blue-400" />
                    }
                  </div>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line",
                    msg.role === "assistant"
                      ? "bg-card border border-border text-foreground rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  )}>
                    {msg.role === "assistant" ? oneSentencePerLine(parsed!.text) : msg.content}
                    {!msg.content && streaming && i === messages.length - 1 && (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                    {parsed && parsed.sources.length > 0 && (
                      <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 not-prose">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Sources</div>
                        <ul className="space-y-1.5">
                          {parsed.sources.map((s, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs">
                              <span className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium border",
                                s.type === "note"
                                  ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                                  : "border-pink-400/40 text-pink-400 bg-pink-400/10"
                              )}>
                                {s.type}
                              </span>
                              <span className="text-foreground">{s.title || s.id}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-3">
        {hasKnowledge !== false && messages.length <= 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors border border-border"
              >
                <Sparkles className="w-3 h-3 text-pink-400" />
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
            placeholder={
              hasKnowledge === false
                ? "Save a note or highlight to start asking..."
                : "Ask about your notes and highlights..."
            }
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            disabled={composerDisabled}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || composerDisabled}
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
