import OpenAI from "openai";
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

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://openrouter.ai/api/v1",
});

const MODEL = process.env.DEEPSEEK_MODEL || "google/gemma-4-31b-instruct:free";
const MAX_ROUNDS = 10;

function openaiParameters(zodSchema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(zodSchema, {
    target: "openapi-3.0",
    reused: "inline",
  }) as Record<string, unknown>;
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "fetch_chart_data",
      description:
        "Generate synthetic data for a chart based on the user's request. " +
        "Call this when you need numerical data to populate a chart. " +
        "Provide the query describing what data you need, and optionally specify years, categories, and series names. " +
        "Returns labeled data arrays suitable for Chart.js.",
      parameters: openaiParameters(fetchChartDataParamsSchema),
    },
  },
  {
    type: "function",
    function: {
      name: "validate_chart_data",
      description:
        "Validate a Chart.js configuration object. " +
        "Checks that labels exist, datasets are non-empty, each dataset has a matching data array, and all values are numbers. " +
        "Returns { valid: boolean, errors: string[] }. If valid is false, fix the errors and call again.",
      parameters: openaiParameters(chartConfigSchema),
    },
  },
];

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

export async function generateChartConfig(
  prompt: string,
): Promise<{ config: ChartConfig; toolCalls: ToolCallRecord[] }> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    { role: "user", content: prompt },
  ];

  const toolCalls: ToolCallRecord[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      const text = (message.content || "").trim();
      const cleaned = text
        .replace(/^```(?:json)?\s*/m, "")
        .replace(/\s*```$/m, "");
      try {
        const config = JSON.parse(cleaned) as ChartConfig;
        return { config, toolCalls };
      } catch {
        throw new Error(
          `Failed to parse chart config from response: ${cleaned}`,
        );
      }
    }

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;
      const fn = toolCall.function;
      if (fn.name === "fetch_chart_data") {
        const args = JSON.parse(fn.arguments) as FetchChartDataParams;
        const output = fetchChartData(args);
        toolCalls.push({ name: "fetch_chart_data", args: args as unknown as Record<string, unknown>, result: output });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(output),
        });
      } else if (fn.name === "validate_chart_data") {
        const args = JSON.parse(fn.arguments) as Record<string, unknown>;
        const output = validateChartConfig(args);
        toolCalls.push({ name: "validate_chart_data", args, result: output });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(output),
        });
      }
    }
  }

  throw new Error("Max rounds reached without a valid chart config");
}
