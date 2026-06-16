import { GoogleGenerativeAI, type FunctionDeclaration, Part } from "@google/generative-ai";
import { z } from "zod";
import {
  fetchChartData,
  validateChartConfig,
} from "./tools";
import {
  ChartConfig,
  FetchChartDataParams,
  fetchChartDataParamsSchema,
  chartConfigSchema,
  ToolCallRecord,
} from "./validation";

import dotenv from "dotenv";
dotenv.config();

function stripUnsupported(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsupported);
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "additionalProperties" || key === "$schema" || key === "$defs") continue;
      cleaned[key] = stripUnsupported(val);
    }
    return cleaned;
  }
  return value;
}

function toGeminiSchema(zodSchema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(zodSchema, {
    target: "openapi-3.0",
    reused: "inline",
  });
  return stripUnsupported(jsonSchema) as Record<string, unknown>;
}

function makeDeclaration(
  name: string,
  description: string,
  schema: z.ZodType,
): FunctionDeclaration {
  return {
    name,
    description,
    parameters: toGeminiSchema(schema) as unknown as FunctionDeclaration["parameters"],
  };
}

const fetchChartDataDeclaration = makeDeclaration(
  "fetch_chart_data",
  "Generate synthetic data for a chart based on the user's request. " +
    "Call this when you need numerical data to populate a chart. " +
    "Provide the query describing what data you need, and optionally specify years, categories, and series names. " +
    "Returns labeled data arrays suitable for Chart.js.",
  fetchChartDataParamsSchema,
);

const validateChartDataDeclaration = makeDeclaration(
  "validate_chart_data",
  "Validate a Chart.js configuration object. " +
    "Checks that labels exist, datasets are non-empty, each dataset has a matching data array, and all values are numbers. " +
    "Returns { valid: boolean, errors: string[] }. If valid is false, fix the errors and call again.",
  chartConfigSchema,
);

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
  // model: "gemini-3-flash-preview",
  model: "gemini-2.0-flash",
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
console.log("Initialized Gemini model:", model);
const MAX_ROUNDS = 10;

export async function generateChartConfig(
  prompt: string,
): Promise<{ config: ChartConfig; toolCalls: ToolCallRecord[] }> {
  try {
    const chat = model.startChat({ history: [] });
    console.log("Starting chat with prompt:", prompt);
    let result = await chat.sendMessage(prompt);

    const toolCalls: ToolCallRecord[] = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const functionCalls = result.response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        const text = result.response.text().trim();
        const cleaned = text
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "");
        try {
          const config = JSON.parse(cleaned) as ChartConfig;
          return { config, toolCalls };
        } catch {
          throw new Error(
            `Failed to parse chart config from Gemini response: ${cleaned}`,
          );
        }
      }

      const responseParts: Part[] = [];
      for (const fc of functionCalls) {
        if (fc.name === "fetch_chart_data") {
          const args = fc.args as unknown as FetchChartDataParams;
          const output = fetchChartData(args);
          toolCalls.push({ name: "fetch_chart_data", args: args as unknown as Record<string, unknown>, result: output });
          responseParts.push({
            functionResponse: { name: fc.name, response: output },
          });
        } else if (fc.name === "validate_chart_data") {
          const args = fc.args as Record<string, unknown>;
          const output = validateChartConfig(args);
          toolCalls.push({ name: "validate_chart_data", args, result: output });
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
