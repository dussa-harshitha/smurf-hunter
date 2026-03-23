import { useMemo } from 'react';
import { TemporalHeatmapData } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface TemporalHeatmapProps {
  data: TemporalHeatmapData[];
  className?: string;
}

export function TemporalHeatmap({ data, className }: TemporalHeatmapProps) {
  const maxTxCount = useMemo(() => Math.max(...data.map(d => d.txCount), 1), [data]);
  const maxValue = useMemo(() => Math.max(...data.map(d => d.totalValue), 0.01), [data]);

  const getBarColor = (d: TemporalHeatmapData) => {
    if (d.avgSuspicion >= 60) return 'bg-red-500/80';
    if (d.avgSuspicion >= 30) return 'bg-amber-500/70';
    return 'bg-cyan-500/60';
  };

  const getIntensityColor = (d: TemporalHeatmapData) => {
    const norm = d.txCount / maxTxCount;
    if (norm === 0) return 'bg-secondary/20';
    if (norm < 0.25) return 'bg-cyan-900/40';
    if (norm < 0.5) return 'bg-cyan-700/50';
    if (norm < 0.75) return 'bg-cyan-500/60';
    return 'bg-cyan-400/80';
  };

  if (data.length === 0) return null;

  return (
    <div className={cn("glass-panel p-4 rounded-lg", className)}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-cyan-500" />
        <span className="text-sm font-medium text-foreground">Transaction Activity</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{data.reduce((s, d) => s + d.txCount, 0)} total txns</span>
      </div>

      {/* Volume bars */}
      <div className="flex items-end gap-[2px] h-16 mb-2">
        {data.map((d, i) => {
          const height = d.txCount > 0 ? Math.max(4, (d.txCount / maxTxCount) * 100) : 0;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-t-sm transition-all hover:opacity-100",
                getBarColor(d),
                height === 0 ? 'opacity-10' : 'opacity-80'
              )}
              style={{ height: `${height}%`, minWidth: '3px' }}
              title={`Bucket ${i + 1}: ${d.txCount} txns, ${d.totalValue.toFixed(2)} ETH, avg suspicion ${d.avgSuspicion.toFixed(0)}`}
            />
          );
        })}
      </div>

      {/* Intensity strip */}
      <div className="flex gap-[1px] mb-3">
        {data.map((d, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-2 rounded-[1px]",
              getIntensityColor(d)
            )}
            style={{ minWidth: '3px' }}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>Oldest</span>
        <span>Recent</span>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end mt-2 gap-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-cyan-500/60" />
          <span className="text-[9px] text-muted-foreground">Low risk</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-amber-500/70" />
          <span className="text-[9px] text-muted-foreground">Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-500/80" />
          <span className="text-[9px] text-muted-foreground">High risk</span>
        </div>
      </div>
    </div>
  );
}
