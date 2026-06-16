# 📊 AI-Powered Chart Generation System

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express)](https://expressjs.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-4-FF6384?logo=chartdotjs)](https://www.chartjs.org/)

---

## 📖 Project Description

This is a chat-style web app that turns a plain-English description into a rendered chart. You type something like *"Show me a bar chart of Nepal GDP growth from 2019 to 2023"*, and an LLM (Gemini or DeepSeek, your choice) acts as an **agent**: it calls a data tool to get numbers, builds a complete Chart.js configuration, calls a validation tool to check its own work, and only returns once the config is structurally correct. The frontend renders the result instantly using Chart.js.

### What this actually demonstrates

The interesting part of this project isn't the chart rendering — it's the **agentic tool-calling loop**: the LLM doesn't just generate JSON in one shot. It's given two tools (`fetch_chart_data` and `validate_chart_data`), told to use them in sequence, and the backend round-trips between the model and the tools until the model produces output that passes a strict Zod schema. This is a small, self-contained example of the same tool-use pattern used in production AI agents.

### Important: the data is synthetic, not real

`fetch_chart_data` does **not** call any real GDP, stock, or population API. It generates **deterministic synthetic data** using a seeded random number generator — the seed is derived from the query text itself, so the same prompt always produces the same numbers, but the numbers are not sourced from anywhere real. Domain-aware ranges (e.g. GDP growth stays between -5% and 12%, inflation between 0–25%) make the output *look* plausible, but this is a structural demo of agentic chart generation, not a real data pipeline.

---

## ✨ Features

- **Two LLM Providers** — Switch between Google Gemini (`gemini-2.0-flash`) and DeepSeek-class models via OpenRouter, controlled by a single `AI_PROVIDER` environment variable
- **Agentic Tool-Calling** — The model is given two callable tools and a system prompt instructing it to: (1) fetch data, (2) build a config, (3) validate the config, (4) self-correct on validation errors, (5) output final JSON
- **Self-Validating Output** — `validate_chart_data` re-runs the same Zod schema the backend uses internally, so the model can catch and fix its own mistakes (mismatched array lengths, missing fields, invalid chart type) before responding
- **5 Chart Types** — Bar, Line, Pie, Doughnut, Radar — the model chooses based on keywords in the prompt (e.g. "trend" → line, "breakdown" → pie, "compare" → bar)
- **Domain-Aware Synthetic Data** — Built-in numeric ranges for GDP, inflation, interest rates, unemployment, stock prices, population, revenue, and profit, so generated numbers look contextually plausible
- **Deterministic Seeding** — The same prompt text always produces the same synthetic dataset (seeded by character-code sum of the query)
- **Tool Call Transparency** — The chat UI shows exactly which tools were called and with what arguments, as a small audit trail under each assistant response
- **Strict Schema Validation** — Every request and every chart config is validated end-to-end with Zod, both client-facing (`/api/generate-chart` request body) and model-facing (the tool schemas)
- **Streaming-Free, Simple Chat UI** — Minimal chat interface built with Tailwind CSS; no streaming, no markdown rendering — just prompt in, chart out
- **Dev Proxy** — Next.js rewrites all `/api/*` requests to the Express backend, so the frontend never needs CORS configuration in local development

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 16 (App Router) |
| **UI Library** | React 19 |
| **Language** | TypeScript 5 / 6 |
| **Styling** | Tailwind CSS 4 |
| **Charting** | Chart.js 4 + react-chartjs-2 |
| **Backend Framework** | Express 5 (Node.js) |
| **LLM Provider A** | Google Gemini (`@google/generative-ai`) |
| **LLM Provider B** | DeepSeek / any OpenRouter model (`openai` SDK pointed at OpenRouter's base URL) |
| **Schema Validation** | Zod 4 (shared between request validation and LLM tool schemas) |
| **Synthetic Data** | `random` (seeded PRNG) |
| **Dev Tooling** | `tsx` + `nodemon` (backend hot reload), Next.js dev server (frontend) |

---

## 🏗️ Architecture Overview

```
Browser (Chat UI)
        │
        │  POST /api/generate-chart  { prompt: "..." }
        ▼
Next.js dev proxy (next.config.ts rewrites)
        │
        ▼
Express Backend (index.ts)
        │
        │  generateChartConfig(prompt)
        ▼
┌──────────────────────────────────────────────┐
│         Provider: gemini.ts or deepseek.ts    │
│                                              │
│  LLM Conversation Loop:                      │
│   1. Send prompt + system instruction        │
│   2. Model calls fetch_chart_data             │
│        └─ tools.ts → seeded synthetic data    │
│   3. Model builds Chart.js config             │
│   4. Model calls validate_chart_data          │
│        └─ tools.ts → Zod validation result    │
│   5. Repeat 3–4 until valid                   │
│   6. Model outputs final JSON config          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
        { config: ChartConfig, toolCalls: [...] }
                       │
                       ▼
Browser → ChartRenderer.tsx → Chart.js canvas
```

---

## 📁 Project Structure

```
ai-powered-chart-generation-system/
│
├── backend/
│   ├── .env.example                # Environment variable template
│   ├── tsconfig.json
│   │
│   └── src/
│       ├── index.ts                # Express app: /api/generate-chart, /health
│       ├── validation.ts           # All Zod schemas + shared TypeScript types
│       ├── tools.ts                # fetch_chart_data + validate_chart_data implementations
│       ├── gemini.ts               # Gemini provider: tool declarations + conversation loop
│       └── deepseek.ts             # DeepSeek/OpenRouter provider: same pattern via OpenAI SDK
│
└── frontend/
    ├── next.config.ts              # Dev proxy: /api/* → http://localhost:3001/api/*
    ├── tsconfig.json
    │
    ├── app/
    │   ├── layout.tsx              # Root layout, fonts, metadata
    │   ├── page.tsx                # Chat UI — message list, input box, send handler
    │   └── globals.css             # Tailwind base styles
    │
    └── components/
        └── ChartRenderer.tsx       # Renders a ChartConfig via react-chartjs-2
```

---

## ⚙️ Installation Guide

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [npm](https://www.npmjs.com/)
- An API key for **at least one** provider:
  - [Google AI Studio](https://aistudio.google.com/app/apikey) for a Gemini API key, **or**
  - [OpenRouter](https://openrouter.ai/keys) for a DeepSeek-class model key

---

### 1. Clone the repository

```bash
git clone https://github.com/Abhimannu09dev/ai-powered-chart-generation-system.git
cd ai-powered-chart-generation-system
```

---

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and configure your chosen provider:

**Option A — Gemini (default):**
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key

PORT=3001
CORS_ORIGIN=http://localhost:3000
```

**Option B — DeepSeek via OpenRouter:**
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-openrouter-api-key
DEEPSEEK_BASE_URL=https://openrouter.ai/api/v1
DEEPSEEK_MODEL=google/gemma-4-31b-instruct:free

PORT=3001
CORS_ORIGIN=http://localhost:3000
```

> **⚠️ Known issue — use `deepseek` for now:** The Gemini provider's multi-round tool-calling loop is currently disabled in the code (the conversation loop only runs once before throwing `"Max rounds reached without a valid chart config"`). Since the model is instructed to always call `fetch_chart_data` first, **every request to the Gemini provider currently fails**. The DeepSeek provider has the correct working loop (up to 10 rounds) and works as expected. Set `AI_PROVIDER=deepseek` until the Gemini loop is fixed — see Future Improvements below.

> **⚠️ Never commit your `.env` file.** It's already in `.gitignore`.

---

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

> **💡 No `.env` needed for the frontend.** The Next.js dev server proxies `/api/*` requests straight to `http://localhost:3001` via `next.config.ts`. If you change the backend port, update the `destination` in that file to match.

---

## ▶️ How to Run the Project Locally

### Start the backend

```bash
cd backend
npm run dev
```

This runs `nodemon --exec tsx src/index.ts` — the server restarts automatically on file changes. You should see:

```
Using DeepSeek provider (model: google/gemma-4-31b-instruct:free)
Backend server running at http://localhost:3001
```

### Start the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

Open your browser at **http://localhost:3000**.

### Health check

```bash
curl http://localhost:3001/health
# → { "status": "ok" }
```

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | No | `gemini` | Which provider to use: `gemini` or `deepseek`. **Use `deepseek` — see known issue above.** |
| `GEMINI_API_KEY` | Only if using Gemini | — | API key from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `DEEPSEEK_API_KEY` | Only if using DeepSeek | — | API key from [OpenRouter](https://openrouter.ai/keys) |
| `DEEPSEEK_BASE_URL` | No | `https://openrouter.ai/api/v1` | Base URL for the OpenAI-compatible client |
| `DEEPSEEK_MODEL` | No | `google/gemma-4-31b-instruct:free` | Which model to call through OpenRouter |
| `PORT` | No | `3001` | Port the Express server listens on |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed origin for CORS |

The frontend has no `.env` file — it relies on the Next.js dev proxy to reach the backend.

---

## 📡 API Endpoints

### `POST /api/generate-chart`

Generates a Chart.js configuration from a natural-language prompt.

**Request body:**
```json
{ "prompt": "Show me a bar chart of Nepal GDP growth from 2019 to 2023" }
```

**Success response (200):**
```json
{
  "config": {
    "type": "bar",
    "data": {
      "labels": ["2019", "2020", "2021", "2022", "2023"],
      "datasets": [
        { "label": "GDP Growth", "data": [4.2, -2.1, 4.8, 5.6, 3.9] }
      ]
    },
    "options": { "plugins": { "title": { "display": true, "text": "Nepal GDP Growth (2019–2023)" } } }
  },
  "toolCalls": [
    { "name": "fetch_chart_data", "args": { "query": "...", "years": ["2019", "..."] }, "result": { "...": "..." } },
    { "name": "validate_chart_data", "args": { "type": "bar", "...": "..." }, "result": { "valid": true, "errors": [] } }
  ]
}
```

**Error response (400 — invalid request):**
```json
{ "error": "Missing or invalid 'prompt' in request body" }
```

**Error response (500 — provider/model error):**
```json
{ "error": "Max rounds reached without a valid chart config" }
```

---

### `GET /health`

Simple liveness check.

```json
{ "status": "ok" }
```

---

## 🧩 How the System Works

### The Agentic Loop (DeepSeek provider — the working one)

```
1. messages = [system prompt, user prompt]
2. Loop (up to 10 rounds):
     a. Send messages + tool definitions to the model
     b. Model responds with EITHER tool_calls OR final text
     c. If tool_calls:
          - fetch_chart_data  → tools.ts generates seeded synthetic data
          - validate_chart_data → tools.ts runs the Zod schema, returns { valid, errors }
          - Append tool results to messages, continue loop
     d. If final text (no tool_calls):
          - Strip markdown code fences if present
          - JSON.parse the result → return { config, toolCalls }
3. If 10 rounds pass with no valid output → throw "Max rounds reached"
```

This is a textbook **ReAct-style agent loop**: the model alternates between reasoning ("I need data" → call tool) and acting (receiving the tool result and deciding the next step), with the system prompt explicitly defining the 5-step process it must follow.

### Synthetic Data Generation (`tools.ts`)

```
fetchChartData({ query, years, categories, series })
  │
  ├─ detectChartType(query)
  │    Regex-matches keywords: "trend"/"growth" → line, "share"/"breakdown" → pie,
  │    "compare"/"vs" → bar, "distribution" → radar. Defaults to bar.
  │
  ├─ detectRange(query)
  │    Regex-matches domain keywords (gdp, inflation, interest, unemployment,
  │    stock, population, revenue, profit) to a { min, max, decimals } range.
  │    Falls back to a generic 0–100 range.
  │
  ├─ seed = sum of character codes in query + label count
  │    new Random(seed) → same query always produces the same numbers
  │
  └─ For each series label, generate one number per label/year/category
       within the detected range, rounded to the domain's decimal precision
```

### Self-Validation Loop

The same `chartConfigSchema` (Zod) is used in two places: once to validate the final API response server-side, and once as a callable tool (`validate_chart_data`) that the model itself can invoke mid-conversation. This means the model gets to "see" its own validation errors (e.g. *"config.data.datasets: Each dataset's data length must match labels length"*) and correct them in the next message — without the backend needing any custom retry logic of its own.

### Frontend Rendering

`ChartRenderer.tsx` is a thin wrapper around `react-chartjs-2`'s generic `<Chart>` component. It registers every Chart.js element type up front (`BarElement`, `LineElement`, `ArcElement`, `RadialLinearScale`, etc.) so it can render any of the 5 supported chart types without per-type imports. The backend's `config.type` value is passed straight through.

---

## 📸 Screenshots / Demo

> Screenshots and a live demo link will be added here.

| View | Description |
|---|---|
| `[Chat UI — Empty State]` | Suggested example prompt, ready to send |
| `[Chat UI — Tool Calls]` | Assistant message showing the `fetch_chart_data` → `validate_chart_data` audit trail |
| `[Rendered Chart]` | Final bar/line/pie chart rendered inline in the chat |

---

## 🚀 Future Improvements

- [ ] Replace synthetic data generation with a real data source (a public statistics API, or a user-uploaded CSV) for genuinely accurate charts
- [ ] Persist chat history (currently lost on page refresh — state lives only in React `useState`)
- [ ] Stream the model's response token-by-token instead of waiting for the full tool-calling loop to finish
- [ ] Add a "regenerate" button to re-run the same prompt with a different chart type
- [ ] Export the generated chart as PNG/SVG
- [ ] Replace the hardcoded `http://localhost:3001` in `next.config.ts` with an environment variable for production deployment
- [ ] Add backend rate limiting — currently any client can call `/api/generate-chart` without limit
- [ ] Unit tests for `tools.ts` detection logic (`detectChartType`, `detectRange`)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Test against both providers if your change touches `gemini.ts` or `deepseek.ts`
4. Commit: `git commit -m "feat: add your feature"`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**.

---

> *Built with Next.js, Express, and dual LLM providers (Gemini / DeepSeek) to explore agentic tool-calling for structured output generation.*
