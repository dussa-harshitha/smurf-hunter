import { WalletNode, TemporalPattern } from '@/types/transaction';
import { getSuspicionLevel } from '@/lib/smurfingDetector';
import { 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  Activity, 
  Shield, 
  ShieldAlert, 
  ShieldX,
  Zap,
  Crosshair,
  Flag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WalletPanelProps {
  wallet: WalletNode | null;
  onClose: () => void;
  temporalPatterns?: TemporalPattern[];
  onSetAsSeed?: () => void;
  onFlagWallet?: (flag: 'confirmed_laundering' | 'suspicious' | 'cleared') => void;
  showForensicActions?: boolean;
}

export function WalletPanel({ 
  wallet, 
  onClose, 
  temporalPatterns = [],
  onSetAsSeed,
  onFlagWallet,
  showForensicActions = true
}: WalletPanelProps) {
  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <Shield className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-center text-lg">Click on a wallet node to inspect its details</p>
        <p className="text-center text-sm mt-2 opacity-60">The graph shows transaction flows between wallets</p>
      </div>
    );
  }

  const suspicionLevel = getSuspicionLevel(wallet.suspicionScore);
  
  const getSuspicionIcon = () => {
    switch (suspicionLevel) {
      case 'low': return <Shield className="w-6 h-6" />;
      case 'medium': return <ShieldAlert className="w-6 h-6" />;
      case 'high': return <ShieldX className="w-6 h-6" />;
    }
  };

  const getRhythmBadge = () => {
    switch (wallet.transactionRhythm) {
      case 'normal':
        return <span className="suspicion-badge-low px-2 py-1 rounded text-xs">Normal activity</span>;
      case 'suspicious':
        return <span className="suspicion-badge-medium px-2 py-1 rounded text-xs">Suspiciously coordinated</span>;
      case 'highly_suspicious':
        return <span className="suspicion-badge-high px-2 py-1 rounded text-xs">Highly suspicious automation</span>;
    }
  };

  const getPatternSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low': return 'text-suspicion-low border-suspicion-low/30 bg-suspicion-low/10';
      case 'medium': return 'text-suspicion-medium border-suspicion-medium/30 bg-suspicion-medium/10';
      case 'high': return 'text-suspicion-high border-suspicion-high/30 bg-suspicion-high/10';
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Wallet Details</h2>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Address */}
        <div className="glass-panel p-3 mb-3">
          <p className="stat-label mb-1">Address</p>
          <p className="address-text text-primary break-all">{wallet.address}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Entity Type: <span className="text-foreground">{wallet.entityType}</span>
          </p>
        </div>

        {/* Quick Actions */}
        {showForensicActions && (
          <div className="flex gap-2 mb-3">
            {onSetAsSeed && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSetAsSeed}
                className="flex-1 h-8 text-xs"
              >
                <Crosshair className="w-3 h-3 mr-1" />
                Set as Seed
              </Button>
            )}
            {onFlagWallet && (
              <Select onValueChange={(v) => onFlagWallet(v as any)}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <Flag className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="Flag wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed_laundering">
                    <span className="text-red-500">Confirmed Laundering</span>
                  </SelectItem>
                  <SelectItem value="suspicious">
                    <span className="text-amber-500">Suspicious</span>
                  </SelectItem>
                  <SelectItem value="cleared">
                    <span className="text-green-500">Cleared</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Suspicion Score */}
        <div className={cn(
          "p-4 rounded-lg border flex items-center gap-4",
          suspicionLevel === 'low' && "bg-suspicion-low/10 border-suspicion-low/30",
          suspicionLevel === 'medium' && "bg-suspicion-medium/10 border-suspicion-medium/30",
          suspicionLevel === 'high' && "bg-suspicion-high/10 border-suspicion-high/30 danger-glow",
        )}>
          <div className={cn(
            suspicionLevel === 'low' && "text-suspicion-low",
            suspicionLevel === 'medium' && "text-suspicion-medium",
            suspicionLevel === 'high' && "text-suspicion-high",
          )}>
            {getSuspicionIcon()}
          </div>
          <div className="flex-1">
            <p className="stat-label">Suspicion Score</p>
            <p className={cn(
              "text-3xl font-bold",
              suspicionLevel === 'low' && "text-suspicion-low",
              suspicionLevel === 'medium' && "text-suspicion-medium",
              suspicionLevel === 'high' && "text-suspicion-high",
            )}>
              {wallet.suspicionScore}
              <span className="text-lg font-normal text-muted-foreground">/100</span>
            </p>
          </div>
          {/* Temporal Attention Score */}
          {wallet.temporalAttentionScore !== undefined && wallet.temporalAttentionScore > 0 && (
            <div className="text-right">
              <p className="stat-label flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Temporal
              </p>
              <p className={cn(
                "text-xl font-bold",
                wallet.temporalAttentionScore >= 70 ? "text-red-500" :
                wallet.temporalAttentionScore >= 50 ? "text-amber-500" :
                "text-cyan-500"
              )}>
                {wallet.temporalAttentionScore}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel p-3">
            <div className="flex items-center gap-2 text-suspicion-high mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span className="stat-label">Total Sent</span>
            </div>
            <p className="stat-value">{wallet.totalSent.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground">{wallet.outgoingCount} transactions</p>
          </div>
          <div className="glass-panel p-3">
            <div className="flex items-center gap-2 text-suspicion-low mb-1">
              <ArrowDownLeft className="w-4 h-4" />
              <span className="stat-label">Total Received</span>
            </div>
            <p className="stat-value">{wallet.totalReceived.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground">{wallet.incomingCount} transactions</p>
          </div>
        </div>
      </div>

      {/* Transaction Rhythm */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-medium">Transaction Rhythm</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {getRhythmBadge()}
        </div>
        <p className="text-sm text-muted-foreground">{wallet.rhythmDescription}</p>
      </div>

      {/* Temporal Patterns */}
      {temporalPatterns.length > 0 && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="font-medium">Temporal Patterns Detected</span>
          </div>
          <div className="space-y-2">
            {temporalPatterns.map((pattern, idx) => (
              <div 
                key={idx}
                className={cn(
                  "p-2 rounded-lg border text-xs",
                  getPatternSeverityColor(pattern.severity)
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium capitalize">{pattern.type.replace('_', ' ')}</span>
                  <span className="text-[10px] uppercase">{pattern.severity}</span>
                </div>
                <p className="text-muted-foreground">{pattern.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suspicion Reasons */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <span className="font-medium">Analysis Results</span>
        </div>
        
        {wallet.suspicionReasons.length > 0 ? (
          <div className="space-y-2">
            {wallet.suspicionReasons.map((reason, index) => (
              <div 
                key={index} 
                className="flex items-start gap-2 p-3 glass-panel rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-suspicion-medium shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No suspicious patterns detected</p>
            <p className="text-sm mt-1">This wallet appears to have normal activity</p>
          </div>
        )}

        {/* Pattern Indicators */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="stat-label mb-2">Pattern Indicators</p>
          <div className="flex flex-wrap gap-2">
            {wallet.participatesInFanOut && (
              <span className="suspicion-badge-high px-2 py-1 rounded text-xs">Fan-out</span>
            )}
            {wallet.participatesInFanIn && (
              <span className="suspicion-badge-high px-2 py-1 rounded text-xs">Fan-in</span>
            )}
            {wallet.isPeelingSource && (
              <span className="suspicion-badge-medium px-2 py-1 rounded text-xs">Peeling Chain</span>
            )}
            {wallet.isManuallyFlagged && (
              <span className={cn(
                "px-2 py-1 rounded text-xs",
                wallet.flaggedAs === 'confirmed_laundering' ? "bg-red-500/20 text-red-500" :
                wallet.flaggedAs === 'suspicious' ? "bg-amber-500/20 text-amber-500" :
                "bg-green-500/20 text-green-500"
              )}>
                {wallet.flaggedAs === 'confirmed_laundering' ? '🚨 Flagged' :
                 wallet.flaggedAs === 'suspicious' ? '⚠️ Suspicious' : '✓ Cleared'}
              </span>
            )}
            {!wallet.participatesInFanOut && !wallet.participatesInFanIn && !wallet.isPeelingSource && !wallet.isManuallyFlagged && (
              <span className="suspicion-badge-low px-2 py-1 rounded text-xs">No patterns</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
