import { z } from "zod";

export const datasetSchema = z.object({
  label: z
    .string()
    .min(1, "Dataset label must be a non-empty string")
    .describe("Dataset label"),
  data: z
    .array(z.number().finite("Each data value must be a finite number"))
    .describe("Numeric data values"),
  backgroundColor: z.array(z.string()).optional().describe("Background colors"),
  borderColor: z.array(z.string()).optional().describe("Border colors"),
  borderWidth: z.number().optional().describe("Border width"),
});

export const chartDataSchema = z
  .object({
    labels: z
      .array(z.string())
      .nonempty("config.data.labels must be a non-empty array")
      .describe("Labels for the chart axes or segments"),
    datasets: z
      .array(datasetSchema)
      .nonempty("config.data.datasets must be a non-empty array")
      .describe("Array of dataset objects"),
  })
  .refine(
    (data) =>
      data.datasets.every((ds) => ds.data.length === data.labels.length),
    {
      message: "Each dataset's data length must match labels length",
      path: ["datasets"],
    },
  );

export const chartConfigSchema = z.object({
  type: z
    .enum(["bar", "line", "pie", "doughnut", "radar"])
    .describe("Chart type"),
  data: chartDataSchema.describe("Chart.js data object"),
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Chart.js options (title, scales, plugins, etc.)"),
});

export const generateChartRequestSchema = z.object({
  prompt: z.string().min(1, "Missing or invalid 'prompt' in request body"),
});

export const fetchChartDataParamsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Description of the data needed, e.g. 'Nepal GDP growth from 2019 to 2023'",
    ),
  years: z
    .array(z.string())
    .optional()
    .describe(
      "Years or time periods for the data (e.g. ['2019','2020','2021'])",
    ),
  categories: z
    .array(z.string())
    .optional()
    .describe(
      "Category labels if not time-based (e.g. ['Agriculture','Industry','Services'])",
    ),
  series: z
    .array(z.string())
    .optional()
    .describe("Names for each data series (e.g. ['GDP Growth'])"),
});

export type Dataset = z.infer<typeof datasetSchema>;
export type ChartConfig = z.infer<typeof chartConfigSchema>;
export type ChartData = z.infer<typeof chartDataSchema>;
export type GenerateChartRequest = z.infer<typeof generateChartRequestSchema>;
export type FetchChartDataParams = z.infer<typeof fetchChartDataParamsSchema>;
