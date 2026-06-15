import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { generateChartConfig } from "./gemini";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY is not set in environment");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

app.post("/api/generate-chart", async (req: Request, res: Response) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    res
      .status(400)
      .json({ error: "Missing or invalid 'prompt' in request body" });
    return;
  }

  try {
    const TIMEOUT_MS = 25000;
    const config = await Promise.race([
      generateChartConfig(prompt),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error("Request timed out — Gemini API did not respond in time"),
          );
        }, TIMEOUT_MS);
      }),
    ]);

    res.json({ config });
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
