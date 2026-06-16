"use client";

import { useState, useRef, useEffect } from "react";
import ChartRenderer from "@/components/ChartRenderer";
import type { ChartConfig } from "@/components/ChartRenderer";

type ToolCallRecord = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  chartConfig?: ChartConfig | null;
  toolCalls?: ToolCallRecord[];
};

function formatToolArgs(name: string, args: Record<string, unknown>): string {
  if (name === "fetch_chart_data") {
    const parts: string[] = [];
    if (args.query) parts.push(`query="${String(args.query).slice(0, 40)}"`);
    if (args.years) parts.push(`years=[${(args.years as string[]).join(", ")}]`);
    if (args.categories) parts.push(`categories=[${(args.categories as string[]).join(", ")}]`);
    return parts.join(" ");
  }
  return Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 30)}`)
    .join(" ");
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: "Here's your chart:",
        chartConfig: data.config,
        toolCalls: data.toolCalls,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${message}`,
        chartConfig: null,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <h1 className="text-lg font-semibold text-zinc-900">
            AI Chart Generator
          </h1>
          <p className="text-xs text-zinc-500">
            Describe a chart in plain English
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && !loading && (
              <div className="text-center text-zinc-400 text-sm pt-12">
                Ask me to create a chart. For example:{" "}
                <button
                  onClick={() =>
                    setInput(
                      "Show me a bar chart of Nepal GDP growth from 2019 to 2023"
                    )
                  }
                  className="text-blue-500 hover:underline cursor-pointer"
                >
                  &ldquo;Show me a bar chart of Nepal GDP growth from 2019 to
                  2023&rdquo;
                </button>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-zinc-200 text-zinc-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {msg.toolCalls.map((tc, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 rounded-lg px-2.5 py-1.5"
                        >
                          <span className="shrink-0 text-emerald-600 font-bold">✓</span>
                          <span className="font-mono font-medium text-zinc-700">
                            {tc.name}
                          </span>
                          <span className="truncate text-zinc-400">
                            {formatToolArgs(tc.name, tc.args)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.role === "assistant" && msg.chartConfig !== undefined && (
                    <div className="mt-3">
                      <ChartRenderer config={msg.chartConfig} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-3">
                  <span className="flex gap-1">
                    <span
                      className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-white shrink-0 px-4 py-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "Show me a bar chart of Nepal GDP growth from 2019 to 2023"'
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 bg-zinc-50 text-zinc-900 placeholder-zinc-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
