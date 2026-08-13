import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TrendPoint } from './dna';

/**
 * 12-month composite-DNA sparkline. Colour follows direction: improving
 * suppliers get the teal accent, degrading ones the muted compliance red.
 */
export interface TrendSparklineProps {
  data: TrendPoint[];
  height?: number;
  /** Stable per-supplier id so gradient defs don't collide across cards. */
  gradientId: string;
}

export function TrendSparkline({ data, height = 40, gradientId }: TrendSparklineProps) {
  const improving = data.length >= 2 && data[data.length - 1].score >= data[0].score;
  const color = improving ? '#2DD4BF' : '#C75A5A';
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
            contentStyle={{
              background: 'rgba(7,17,29,0.96)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '6px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
            labelStyle={{ color: '#8BA8C8', fontSize: 10, fontWeight: 600 }}
            itemStyle={{ color, fontSize: 11, fontWeight: 700 }}
            formatter={(value) => [String(value), 'DNA']}
          />
          <Area
            type="monotone" dataKey="score"
            stroke={color} strokeWidth={1.8}
            fill={`url(#${gradientId})`}
            dot={false} activeDot={{ r: 2.5, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
