import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TimelineSliderProps {
  minTime: number;
  maxTime: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  onRangeChange: (start: number, end: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  transactionCount: number;
  filteredCount: number;
}

export function TimelineSlider({
  minTime,
  maxTime,
  currentTime,
  onTimeChange,
  onRangeChange,
  isPlaying,
  onPlayPause,
  playbackSpeed,
  onSpeedChange,
  transactionCount,
  filteredCount
}: TimelineSliderProps) {
  const [rangeStart, setRangeStart] = useState(minTime);
  const [rangeEnd, setRangeEnd] = useState(maxTime);
  const [showRangeMode, setShowRangeMode] = useState(false);
  const animationRef = useRef<number>();

  // Format time for display
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
    return `${(seconds / 86400).toFixed(1)}d`;
  };

  // Animation loop for playback
  useEffect(() => {
    if (isPlaying) {
      const step = () => {
        const increment = ((maxTime - minTime) / 200) * playbackSpeed;
        const newTime = currentTime - increment; // Decrement because higher age = older
        
        if (newTime <= minTime) {
          onTimeChange(maxTime);
        } else {
          onTimeChange(newTime);
        }
        
        animationRef.current = requestAnimationFrame(step);
      };
      
      animationRef.current = requestAnimationFrame(step);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isPlaying, currentTime, minTime, maxTime, playbackSpeed, onTimeChange]);

  const handleSliderChange = useCallback((values: number[]) => {
    if (showRangeMode && values.length === 2) {
      setRangeStart(values[0]);
      setRangeEnd(values[1]);
      onRangeChange(values[0], values[1]);
    } else if (values.length === 1) {
      onTimeChange(values[0]);
    }
  }, [showRangeMode, onRangeChange, onTimeChange]);

  const handleReset = () => {
    setRangeStart(minTime);
    setRangeEnd(maxTime);
    onTimeChange(maxTime);
    onRangeChange(minTime, maxTime);
  };

  const progress = maxTime > minTime 
    ? ((maxTime - currentTime) / (maxTime - minTime)) * 100 
    : 0;

  return (
    <div className="w-full bg-card/90 backdrop-blur-xl border-t border-b border-border px-6 py-3">
      <div className="max-w-[1920px] mx-auto">
        {/* Top row - Controls and info */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Temporal Flow</span>
            <div className="h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground">
              Showing <span className="text-primary font-medium">{filteredCount}</span> of {transactionCount} transactions
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Playback controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTimeChange(maxTime)}
              className="h-7 w-7 p-0"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            
            <Button
              variant={isPlaying ? "default" : "outline"}
              size="sm"
              onClick={onPlayPause}
              className={cn(
                "h-8 w-8 p-0 rounded-full",
                isPlaying && "bg-primary text-primary-foreground animate-pulse"
              )}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTimeChange(minTime)}
              className="h-7 w-7 p-0"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Speed controls */}
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-muted-foreground" />
              {[0.5, 1, 2, 4].map(speed => (
                <Button
                  key={speed}
                  variant={playbackSpeed === speed ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onSpeedChange(speed)}
                  className={cn(
                    "h-6 px-2 text-xs",
                    playbackSpeed === speed && "bg-primary/20 text-primary"
                  )}
                >
                  {speed}x
                </Button>
              ))}
            </div>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Range mode toggle */}
            <Button
              variant={showRangeMode ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRangeMode(!showRangeMode)}
              className="h-7 text-xs"
            >
              {showRangeMode ? 'Range' : 'Scrub'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 text-xs"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Slider row */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-16 text-right">
            {formatTime(maxTime)} ago
          </span>
          
          <div className="flex-1 relative">
            {/* Progress bar background */}
            <div className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary/30 to-primary transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Slider */}
            {showRangeMode ? (
              <Slider
                value={[rangeStart, rangeEnd]}
                min={minTime}
                max={maxTime}
                step={(maxTime - minTime) / 1000}
                onValueChange={handleSliderChange}
                className="relative z-10"
              />
            ) : (
              <Slider
                value={[currentTime]}
                min={minTime}
                max={maxTime}
                step={(maxTime - minTime) / 1000}
                onValueChange={(v) => handleSliderChange(v)}
                className="relative z-10"
              />
            )}

            {/* Time markers */}
            <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-[10px] text-muted-foreground">
              <span>Oldest</span>
              <span>|</span>
              <span>|</span>
              <span>|</span>
              <span>Newest</span>
            </div>
          </div>
          
          <span className="text-xs text-muted-foreground w-16">
            {formatTime(minTime)} ago
          </span>
        </div>

        {/* Current time indicator */}
        <div className="mt-4 flex justify-center">
          <div className="glass-panel px-4 py-1.5 rounded-full">
            <span className="text-xs text-muted-foreground">Current: </span>
            <span className="text-sm font-mono text-primary">{formatTime(currentTime)} ago</span>
            {showRangeMode && (
              <>
                <span className="text-xs text-muted-foreground mx-2">|</span>
                <span className="text-xs text-muted-foreground">Range: </span>
                <span className="text-sm font-mono text-foreground">
                  {formatTime(rangeStart)} - {formatTime(rangeEnd)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
