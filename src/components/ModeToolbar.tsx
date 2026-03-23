import { cn } from '@/lib/utils';
import { Eye, Crosshair } from 'lucide-react';
import { ViewMode } from '@/types/transaction';

interface ModeToolbarProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  seedCount: number;
}

export function ModeToolbar({ currentMode, onModeChange, seedCount }: ModeToolbarProps) {
  const modes: { id: ViewMode; label: string; icon: React.ReactNode; description: string }[] = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: <Eye className="w-4 h-4" />,
      description: 'Full network visualization with temporal analysis'
    },
    { 
      id: 'forensic', 
      label: 'Forensic Anchor', 
      icon: <Crosshair className="w-4 h-4" />,
      description: 'Seed-driven subgraph expansion & investigation'
    },
  ];

  return (
    <div className="w-full bg-card/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1920px] mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  "hover:bg-secondary/80",
                  currentMode === mode.id 
                    ? "bg-primary/20 text-primary border border-primary/30" 
                    : "text-muted-foreground border border-transparent"
                )}
              >
                {mode.icon}
                <span>{mode.label}</span>
                {mode.id === 'forensic' && seedCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-xs">
                    {seedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {modes.find(m => m.id === currentMode)?.description}
          </p>
        </div>
      </div>
    </div>
  );
}
