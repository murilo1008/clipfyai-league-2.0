"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

/*
 * Mini gráficos dos perfis e vídeos oficiais. Ficam num módulo próprio para
 * o recharts carregar só quando há histórico para desenhar.
 */

export function ProfileFollowersSparkline({
  id,
  data,
}: {
  id: string;
  data: Array<{ date: string; followers?: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`profile-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="followers"
          stroke="#14b8a6"
          fill={`url(#profile-${id})`}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function VideoViewsSparkline({
  data,
}: {
  data: Array<{ date: string; views?: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="views"
          stroke="#8b5cf6"
          fill="#8b5cf622"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
