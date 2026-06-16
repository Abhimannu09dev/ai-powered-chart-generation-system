import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import {
  fetchChartData,
  validateChartConfig,
  fetchChartDataDeclaration,
  validateChartDataDeclaration,
} from "./tools";
import { ChartConfig, FetchChartDataParams } from "./validation";

import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
console.log(genAI);

const SYSTEM_INSTRUCTION =
  "You are a chart generation assistant. Your job is to produce valid Chart.js configuration objects. " +
  "Follow this process for every request:\n" +
  "1. Call fetch_chart_data to get the data you need. Pass the user's request as the query, " +
  "and include relevant years, categories, and series names.\n" +
  "2. Build a complete Chart.js config object using the returned data. " +
  "Choose an appropriate chart type (bar, line, pie, doughnut, radar). " +
  "3. Call validate_chart_data with your config. " +
  "4. If validation returns errors, fix them and call validate_chart_data again. " +
  "5. Once validation passes, output ONLY a JSON object containing the chart config " +
  "with keys: type, data, options. Do not wrap in markdown or add extra text.";

const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  systemInstruction: SYSTEM_INSTRUCTION,
  tools: [
    {
      functionDeclarations: [
        fetchChartDataDeclaration,
        validateChartDataDeclaration,
      ],
    },
  ],
});

const MAX_ROUNDS = 10;

export async function generateChartConfig(
  prompt: string,
): Promise<ChartConfig> {
  try {
    const chat = model.startChat({ history: [] });

    let result = await chat.sendMessage(prompt);

    console.log("Initial Gemini response:", result.response.text());

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const functionCalls = result.response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        const text = result.response.text().trim();
        const cleaned = text
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "");
        try {
          return JSON.parse(cleaned) as ChartConfig;
        } catch {
          throw new Error(
            `Failed to parse chart config from Gemini response: ${cleaned}`,
          );
        }
      }

      const responseParts: Part[] = [];
      for (const fc of functionCalls) {
        if (fc.name === "fetch_chart_data") {
          const output = fetchChartData(
            fc.args as unknown as FetchChartDataParams,
          );
          responseParts.push({
            functionResponse: { name: fc.name, response: output },
          });
        } else if (fc.name === "validate_chart_data") {
          const args = fc.args as Record<string, unknown>;
          const output = validateChartConfig(args);
          responseParts.push({
            functionResponse: { name: fc.name, response: output },
          });
        }
      }

      result = await chat.sendMessage(responseParts);
    }

    throw new Error("Max rounds reached without a valid chart config");
  } catch (err: unknown) {
    console.log("Error in generateChartConfig:", err);
    throw err;
  }
}
