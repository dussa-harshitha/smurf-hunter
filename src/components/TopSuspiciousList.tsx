import { WalletNode } from '@/types/transaction';
import { getSuspicionLevel } from '@/lib/smurfingDetector';
import { Trophy, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopSuspiciousListProps {
  wallets: WalletNode[];
  onWalletClick: (wallet: WalletNode) => void;
  selectedWalletId: string | null;
}

export function TopSuspiciousList({ wallets, onWalletClick, selectedWalletId }: TopSuspiciousListProps) {
  return (
    <div className="glass-panel p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-suspicion-high" />
        <h3 className="font-semibold text-foreground">Top 10 Suspicious Wallets</h3>
      </div>
      
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {wallets.map((wallet, index) => {
          const level = getSuspicionLevel(wallet.suspicionScore);
          const isSelected = wallet.id === selectedWalletId;
          
          return (
            <button
              key={wallet.id}
              onClick={() => onWalletClick(wallet)}
              className={cn(
                "w-full p-3 rounded-lg text-left transition-all",
                "border border-transparent hover:border-primary/30",
                isSelected ? "bg-primary/20 border-primary/50" : "bg-secondary/50 hover:bg-secondary",
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  index < 3 ? "bg-suspicion-high/20 text-suspicion-high" : "bg-muted text-muted-foreground"
                )}>
                  {index + 1}
                </span>
                
                <div className="flex-1 min-w-0">
                  <p className="address-text text-foreground truncate">
                    {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {wallet.suspicionReasons.length > 0 
                      ? wallet.suspicionReasons[0].slice(0, 40) + '...'
                      : 'Multiple indicators'}
                  </p>
                </div>
                
                <div className={cn(
                  "px-2 py-1 rounded text-xs font-bold",
                  level === 'high' && "bg-suspicion-high/20 text-suspicion-high",
                  level === 'medium' && "bg-suspicion-medium/20 text-suspicion-medium",
                  level === 'low' && "bg-suspicion-low/20 text-suspicion-low",
                )}>
                  {wallet.suspicionScore}
                </div>
              </div>
            </button>
          );
        })}
        
        {wallets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No data loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}
