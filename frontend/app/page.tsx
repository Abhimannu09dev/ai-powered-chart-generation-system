"use client";

import { useState, useRef } from "react";
import ChartRenderer from "@/components/ChartRenderer";
import type { ChartConfig } from "@/components/ChartRenderer";

type Status = "idle" | "loading" | "error" | "done";

const STATUS_LABELS: Record<Status, string> = {
  idle: "",
  loading: "Generating chart...",
  error: "Error",
  done: "Done",
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const loading = status === "loading";

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setChartConfig(null);
    setErrorMessage("");
    setStatus("loading");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      setChartConfig(data.config);
      setStatus("done");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;

      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            AI Chart Generator
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Describe a chart in plain English
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6 max-w-4xl mx-auto w-full">
        <div className="w-full flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. "Show me a bar chart of Nepal GDP growth from 2019 to 2023"'
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            <span>{STATUS_LABELS[status]}</span>
          </div>
        )}

        {errorMessage && (
          <div className="w-full p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="w-full">
          <ChartRenderer config={chartConfig} />
        </div>
      </main>
    </div>
  );
}
