import { Circle } from 'lucide-react';

export function GraphLegend() {
  return (
    <div className="glass-panel p-3 rounded-lg">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Suspicion Level</p>
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Circle className="w-3 h-3 fill-suspicion-low text-suspicion-low" />
          <span className="text-xs text-foreground">Low (0-29)</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="w-3 h-3 fill-suspicion-medium text-suspicion-medium" />
          <span className="text-xs text-foreground">Medium (30-59)</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="w-3 h-3 fill-suspicion-high text-suspicion-high" />
          <span className="text-xs text-foreground">High (60-100)</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Edge thickness = transaction value • Edge opacity = age (newer = brighter)
      </p>
    </div>
  );
}
