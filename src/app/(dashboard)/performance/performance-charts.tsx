"use client";

import dynamic from "next/dynamic";

import { Bone, ChartSkeleton } from "@/components/shared/skeletons";

/*
 * Gráficos da página de performance carregados sob demanda: o recharts sai
 * do bundle inicial e entra só quando há gráfico para mostrar.
 */

export const CpmComparisonChart = dynamic(
  () =>
    import("@/components/performance/cpm-comparison-chart").then(
      (mod) => mod.CpmComparisonChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton heightClass="h-72" /> },
);

export const ProfileFollowersSparkline = dynamic(
  () =>
    import("./performance-sparklines").then(
      (mod) => mod.ProfileFollowersSparkline,
    ),
  { ssr: false, loading: () => <Bone className="h-full w-full rounded-xl" /> },
);

export const VideoViewsSparkline = dynamic(
  () =>
    import("./performance-sparklines").then((mod) => mod.VideoViewsSparkline),
  { ssr: false, loading: () => <Bone className="h-full w-full rounded-xl" /> },
);
