import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { generateChartConfig } from "./gemini";
import { generateChartRequestSchema } from "./validation";

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
  const parsed = generateChartRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { prompt } = parsed.data;
  console.log("Received prompt:", prompt);
  try {
    const config = await generateChartConfig(prompt);
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
