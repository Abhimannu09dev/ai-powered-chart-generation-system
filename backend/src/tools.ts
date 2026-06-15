import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

export interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string[];
  borderColor?: string[];
  borderWidth?: number;
}

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "doughnut" | "radar";
  data: {
    labels: string[];
    datasets: Dataset[];
  };
  options?: Record<string, unknown>;
}

export interface FetchChartDataParams {
  query: string;
  years?: string[];
  categories?: string[];
  series?: string[];
}

export interface FetchChartDataResult {
  labels: string[];
  datasets: { label: string; data: number[] }[];
  suggestedChartType: string;
  title: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

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

function detectChartType(query: string): string {
  const lower = query.toLowerCase();
  if (/\b(trend|over time|growth|change|progress)\b/.test(lower)) return "line";
  if (/\b(share|breakdown|proportion|percentage|composition)\b/.test(lower))
    return "pie";
  if (/\b(compare|comparison|versus|vs)\b/.test(lower)) return "bar";
  if (/\b(distribution|spread)\b/.test(lower)) return "radar";
  return "bar";
}

function detectRange(query: string): {
  min: number;
  max: number;
  decimals: number;
} {
  const lower = query.toLowerCase();
  if (/\bgdp\b/.test(lower)) return domainRanges.gdp;
  if (/\binflat(ion)?\b/.test(lower)) return domainRanges.inflation;
  if (/\binterest\b/.test(lower)) return domainRanges.interest;
  if (/\b(unemploy|jobless)\b/.test(lower)) return domainRanges.unemployment;
  if (/\b(stock|share|price)\b/.test(lower)) return domainRanges.stock;
  if (/\b(population|people)\b/.test(lower)) return domainRanges.population;
  if (/\b(revenue|income|sales)\b/.test(lower)) return domainRanges.revenue;
  if (/\b(profit|earnings)\b/.test(lower)) return domainRanges.profit;
  return domainRanges.default;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
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
): FetchChartDataResult {
  const { query, years, categories, series } = params;

  const labels = years ??
    categories ?? [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

  const datasetLabels = series ?? ["Value"];

  const range = detectRange(query);
  const seed = query
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), labels.length);
  const rand = seededRandom(seed);

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

export function validateChartConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["config must be a non-null object"] };
  }

  const c = config as Record<string, unknown>;

  if (!c.type || typeof c.type !== "string") {
    errors.push("config.type must be a string");
  }

  if (!c.data || typeof c.data !== "object") {
    errors.push("config.data must be an object");
    return { valid: false, errors };
  }

  const data = c.data as Record<string, unknown>;

  if (!Array.isArray(data.labels) || data.labels.length === 0) {
    errors.push("config.data.labels must be a non-empty array");
  } else if (!data.labels.every((l: unknown) => typeof l === "string")) {
    errors.push("config.data.labels must contain only strings");
  }

  if (!Array.isArray(data.datasets) || data.datasets.length === 0) {
    errors.push("config.data.datasets must be a non-empty array");
  } else {
    const labelCount = Array.isArray(data.labels) ? data.labels.length : 0;
    for (let i = 0; i < data.datasets.length; i++) {
      const ds = data.datasets[i] as Record<string, unknown> | undefined;
      if (!ds || typeof ds !== "object") {
        errors.push(`datasets[${i}] must be an object`);
        continue;
      }
      if (typeof ds.label !== "string" || ds.label.length === 0) {
        errors.push(`datasets[${i}].label must be a non-empty string`);
      }
      if (!Array.isArray(ds.data)) {
        errors.push(`datasets[${i}].data must be an array`);
      } else if (labelCount > 0 && ds.data.length !== labelCount) {
        errors.push(
          `datasets[${i}].data length (${ds.data.length}) must match labels length (${labelCount})`,
        );
      } else {
        for (let j = 0; j < ds.data.length; j++) {
          if (typeof ds.data[j] !== "number" || !isFinite(ds.data[j])) {
            errors.push(`datasets[${i}].data[${j}] must be a finite number`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export const fetchChartDataDeclaration: FunctionDeclaration = {
  name: "fetch_chart_data",
  description:
    "Generate synthetic data for a chart based on the user's request. " +
    "Call this when you need numerical data to populate a chart. " +
    "Provide the query describing what data you need, and optionally specify years, categories, and series names. " +
    "Returns labeled data arrays suitable for Chart.js.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description:
          "Description of the data needed, e.g. 'Nepal GDP growth from 2019 to 2023'",
      },
      years: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description:
          "Years or time periods for the data (e.g. ['2019','2020','2021'])",
      },
      categories: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description:
          "Category labels if not time-based (e.g. ['Agriculture','Industry','Services'])",
      },
      series: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Names for each data series (e.g. ['GDP Growth'])",
      },
    },
    required: ["query"],
  },
};

export const validateChartDataDeclaration: FunctionDeclaration = {
  name: "validate_chart_data",
  description:
    "Validate a Chart.js configuration object. " +
    "Checks that labels exist, datasets are non-empty, each dataset has a matching data array, and all values are numbers. " +
    "Returns { valid: boolean, errors: string[] }. If valid is false, fix the errors and call again.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      type: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["bar", "line", "pie", "doughnut", "radar"],
        description: "Chart type",
      },
      data: {
        type: SchemaType.OBJECT,
        description: "Chart.js data object",
        properties: {
          labels: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Labels for the chart axes or segments",
          },
          datasets: {
            type: SchemaType.ARRAY,
            description: "Array of dataset objects",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: {
                  type: SchemaType.STRING,
                  description: "Dataset label",
                },
                data: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.NUMBER },
                  description: "Numeric data values",
                },
                backgroundColor: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Background colors",
                },
                borderColor: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Border colors",
                },
                borderWidth: {
                  type: SchemaType.NUMBER,
                  description: "Border width",
                },
              },
              required: ["label", "data"],
            },
          },
        },
        required: ["labels", "datasets"],
      },
      options: {
        type: SchemaType.OBJECT,
        properties: {},
        description: "Chart.js options (title, scales, plugins, etc.)",
      },
    },
    required: ["type", "data"],
  },
};
