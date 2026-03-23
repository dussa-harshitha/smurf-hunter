import { useEffect, useRef } from 'react';
import { Crosshair, Flag, Search, Copy, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSetAsSeed: () => void;
  onFlagAsLaundering: () => void;
  onFlagAsSuspicious: () => void;
  onFlagAsCleared: () => void;
  onCopyAddress: () => void;
  onViewOnEtherscan: () => void;
  walletAddress: string;
}

export function ContextMenu({
  x,
  y,
  onClose,
  onSetAsSeed,
  onFlagAsLaundering,
  onFlagAsSuspicious,
  onFlagAsCleared,
  onCopyAddress,
  onViewOnEtherscan,
  walletAddress
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const MenuItem = ({ 
    icon: Icon, 
    label, 
    onClick, 
    variant = 'default' 
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void; 
    variant?: 'default' | 'danger' | 'warning' | 'success';
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors rounded-md",
        "hover:bg-secondary",
        variant === 'danger' && "text-red-500 hover:bg-red-500/10",
        variant === 'warning' && "text-amber-500 hover:bg-amber-500/10",
        variant === 'success' && "text-green-500 hover:bg-green-500/10"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  const Separator = () => (
    <div className="h-px bg-border my-1" />
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] glass-panel p-1 rounded-lg shadow-xl border border-border animate-fade-in"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border mb-1">
        <p className="text-xs text-muted-foreground">Wallet</p>
        <p className="font-mono text-xs text-primary truncate">
          {walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}
        </p>
      </div>

      {/* Forensic Actions */}
      <MenuItem 
        icon={Crosshair} 
        label="Set as Forensic Anchor" 
        onClick={onSetAsSeed}
      />
      
      <Separator />
      
      {/* Flag Actions */}
      <p className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        Flag Wallet
      </p>
      <MenuItem 
        icon={Flag} 
        label="Confirmed Laundering" 
        onClick={onFlagAsLaundering}
        variant="danger"
      />
      <MenuItem 
        icon={Flag} 
        label="Suspicious" 
        onClick={onFlagAsSuspicious}
        variant="warning"
      />
      <MenuItem 
        icon={Flag} 
        label="Cleared (False Positive)" 
        onClick={onFlagAsCleared}
        variant="success"
      />

      <Separator />

      {/* Utility Actions */}
      <MenuItem 
        icon={Copy} 
        label="Copy Address" 
        onClick={onCopyAddress}
      />
      <MenuItem 
        icon={ExternalLink} 
        label="View on Etherscan" 
        onClick={onViewOnEtherscan}
      />
    </div>
  );
}
