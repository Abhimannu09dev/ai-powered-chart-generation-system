import { z } from "zod";
import { Random } from "random";
import {
  chartConfigSchema,
  fetchChartDataParamsSchema,
  type FetchChartDataParams,
} from "./validation";

const DEFAULT_MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const domainRanges: Record<
  string,
  { min: number; max: number; decimals: number }
> = {
  gdp: { min: -5, max: 12, decimals: 1 },
  inflation: { min: 0, max: 25, decimals: 1 },
  interest: { min: 0.5, max: 15, decimals: 1 },
  unemployment: { min: 1, max: 30, decimals: 1 },
  stock: { min: 10, max: 500, decimals: 2 },
  population: { min: 0.5, max: 1500, decimals: 0 },
  revenue: { min: 1, max: 500, decimals: 0 },
  profit: { min: -50, max: 100, decimals: 0 },
  default: { min: 0, max: 100, decimals: 1 },
};

const chartTypeRules: [RegExp, string][] = [
  [/\b(trend|over time|growth|change|progress)\b/, "line"],
  [/\b(share|breakdown|proportion|percentage|composition)\b/, "pie"],
  [/\b(compare|comparison|versus|vs)\b/, "bar"],
  [/\b(distribution|spread)\b/, "radar"],
];

const rangeRules: [RegExp, keyof typeof domainRanges][] = [
  [/\bgdp\b/, "gdp"],
  [/\binflat(ion)?\b/, "inflation"],
  [/\binterest\b/, "interest"],
  [/\b(unemploy|jobless)\b/, "unemployment"],
  [/\b(stock|share|price)\b/, "stock"],
  [/\b(population|people)\b/, "population"],
  [/\b(revenue|income|sales)\b/, "revenue"],
  [/\b(profit|earnings)\b/, "profit"],
];

function detectChartType(query: string): string {
  const lower = query.toLowerCase();
  return chartTypeRules.find(([re]) => re.test(lower))?.[1] ?? "bar";
}

function detectRange(query: string): {
  min: number;
  max: number;
  decimals: number;
} {
  const lower = query.toLowerCase();
  const key = rangeRules.find(([re]) => re.test(lower))?.[1] ?? "default";
  return domainRanges[key];
}

function generateDataPoint(
  range: { min: number; max: number; decimals: number },
  rand: () => number,
): number {
  const val = range.min + rand() * (range.max - range.min);
  return parseFloat(val.toFixed(range.decimals));
}

export function fetchChartData(
  params: FetchChartDataParams,
): { labels: string[]; datasets: { label: string; data: number[] }[]; suggestedChartType: string; title: string } {
  const { query, years, categories, series } = params;

  const labels = years ??
    categories ?? [...DEFAULT_MONTH_LABELS];

  const datasetLabels = series ?? ["Value"];

  const range = detectRange(query);
  const seed = query
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), labels.length);
  const seeded = new Random(seed);
  const rand = seeded.uniform();

  const datasets = datasetLabels.map((label) => {
    const data = labels.map(() => generateDataPoint(range, rand));
    return { label, data };
  });

  const cleaned = query.replace(/["']/g, "");
  const title = cleaned.length > 80 ? cleaned.slice(0, 80) + "..." : cleaned;

  return {
    labels,
    datasets,
    suggestedChartType: detectChartType(query),
    title,
  };
}

export function validateChartConfig(
  config: unknown,
): { valid: boolean; errors: string[] } {
  const result = chartConfigSchema.safeParse(config);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map(
      (issue) => `config.${issue.path.join(".")}: ${issue.message}`,
    ),
  };
}


