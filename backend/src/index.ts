import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { generateChartRequestSchema, ChartConfig, ToolCallRecord } from "./validation";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

async function start() {
  const provider = process.env.AI_PROVIDER || "gemini";

  let generateChartConfig: (prompt: string) => Promise<{ config: ChartConfig; toolCalls: ToolCallRecord[] }>;

  if (provider === "deepseek") {
    const deepseek = await import("./deepseek");
    generateChartConfig = deepseek.generateChartConfig;
    console.log(`Using DeepSeek provider (model: ${process.env.DEEPSEEK_MODEL || "google/gemma-4-31b-instruct:free"})`);
  } else {
    const gemini = await import("./gemini");
    generateChartConfig = gemini.generateChartConfig;
    console.log(`Using Gemini provider (model: gemini-2.0-flash)`);
  }

  app.post("/api/generate-chart", async (req: Request, res: Response) => {
    const parsed = generateChartRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { prompt } = parsed.data;
    try {
      const { config, toolCalls } = await generateChartConfig(prompt);
      console.log("Generated chart config:", config);
      console.log("Tool calls:", toolCalls);
      res.json({ config, toolCalls });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred";
      res.status(500).json({ error: message });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}`);
  });
}

start();
