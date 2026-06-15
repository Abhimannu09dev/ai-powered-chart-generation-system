"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend
);

interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string[];
  borderColor?: string[];
  borderWidth?: number;
}

interface ChartConfig {
  type: "bar" | "line" | "pie" | "doughnut" | "radar";
  data: {
    labels: string[];
    datasets: Dataset[];
  };
  options?: Record<string, unknown>;
}

interface ChartRendererProps {
  config: ChartConfig | null;
}

export default function ChartRenderer({ config }: ChartRendererProps) {
  if (!config) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-400">
        Your chart will appear here
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Chart type={config.type} data={config.data} options={config.options} />
    </div>
  );
}

export type { ChartConfig, Dataset };
