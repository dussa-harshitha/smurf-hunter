import { useState } from 'react';
import { 
  Crosshair, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ArrowRight, 
  ArrowLeft, 
  ArrowLeftRight,
  Filter,
  Layers,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  SeedWallet, 
  SubgraphExpansionConfig, 
  InverseTopologyMapping,
  WalletNode 
} from '@/types/transaction';

interface ForensicPanelProps {
  config: SubgraphExpansionConfig;
  onConfigChange: (config: SubgraphExpansionConfig) => void;
  inverseMapping: InverseTopologyMapping[];
  selectedWallet: WalletNode | null;
  onAddSeed: () => void;
  onRemoveSeed: (seedId: string) => void;
  onWalletClick: (address: string) => void;
  onExpand: () => void;
  isExpanding: boolean;
  timeRange: { min: number; max: number };
}

export function ForensicPanel({
  config,
  onConfigChange,
  inverseMapping,
  selectedWallet,
  onAddSeed,
  onRemoveSeed,
  onWalletClick,
  onExpand,
  isExpanding,
  timeRange
}: ForensicPanelProps) {
  const [showFilters, setShowFilters] = useState(false);

  const updateConfig = (updates: Partial<SubgraphExpansionConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const getDirectionIcon = (dir: string) => {
    switch (dir) {
      case 'forward': return <ArrowRight className="w-4 h-4" />;
      case 'backward': return <ArrowLeft className="w-4 h-4" />;
      default: return <ArrowLeftRight className="w-4 h-4" />;
    }
  };

  const getRelationshipBadge = (rel: 'sends_to' | 'receives_from' | 'bidirectional') => {
    const styles = {
      sends_to: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      receives_from: 'bg-green-500/20 text-green-400 border-green-500/30',
      bidirectional: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    const labels = {
      sends_to: '→ Sends',
      receives_from: '← Receives',
      bidirectional: '↔ Both'
    };
    return (
      <span className={cn("px-1.5 py-0.5 rounded text-[10px] border", styles[rel])}>
        {labels[rel]}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Crosshair className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">Forensic Anchor</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Select seed wallets and expand to investigate connected networks
        </p>
      </div>

      {/* Seeds Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Seed Wallets</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSeed}
            disabled={!selectedWallet || config.seeds.some(s => s.address === selectedWallet.address)}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Selected
          </Button>
        </div>

        {config.seeds.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No seeds selected</p>
            <p className="text-xs mt-1">Click a wallet node, then "Add Selected"</p>
          </div>
        ) : (
          <div className="space-y-2">
            {config.seeds.map((seed, idx) => (
              <div 
                key={seed.id}
                className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: seed.color }}
                  />
                  <span className="font-mono text-xs text-foreground">
                    {formatAddress(seed.address)}
                  </span>
                  {seed.label && (
                    <span className="text-xs text-muted-foreground">
                      ({seed.label})
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveSeed(seed.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expansion Controls */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Expansion Settings</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-7 text-xs"
          >
            <Filter className="w-3 h-3 mr-1" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>

        {/* K-Hops */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">K-Hop Distance</Label>
            <span className="text-xs font-mono text-primary">{config.kHops}</span>
          </div>
          <Slider
            value={[config.kHops]}
            min={1}
            max={5}
            step={1}
            onValueChange={([v]) => updateConfig({ kHops: v })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1 hop</span>
            <span>5 hops</span>
          </div>
        </div>

        {/* Direction */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Expansion Direction</Label>
          <div className="grid grid-cols-3 gap-1">
            {(['forward', 'backward', 'bidirectional'] as const).map(dir => (
              <Button
                key={dir}
                variant={config.expansionDirection === dir ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateConfig({ expansionDirection: dir })}
                className={cn(
                  "h-8 text-xs capitalize",
                  config.expansionDirection === dir && "bg-primary/20 text-primary border-primary/30"
                )}
              >
                {getDirectionIcon(dir)}
                <span className="ml-1 hidden sm:inline">{dir}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="space-y-4 pt-2 border-t border-border/50">
            {/* Min Value */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Min Value (ETH)</Label>
                <span className="text-xs font-mono text-primary">{config.minValueThreshold.toFixed(2)}</span>
              </div>
              <Slider
                value={[config.minValueThreshold]}
                min={0}
                max={10}
                step={0.1}
                onValueChange={([v]) => updateConfig({ minValueThreshold: v })}
              />
            </div>

            {/* Entity Type Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Entity Type Filter</Label>
              <Select
                value={config.entityTypeFilter[0] || 'all'}
                onValueChange={(v) => updateConfig({ 
                  entityTypeFilter: v === 'all' ? [] : [v] 
                })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="wallet_or_contract">Wallet/Contract</SelectItem>
                  <SelectItem value="known_entity">Known Entity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Expand Button */}
        <Button
          className="w-full"
          onClick={onExpand}
          disabled={config.seeds.length === 0 || isExpanding}
        >
          {isExpanding ? (
            <>
              <Layers className="w-4 h-4 mr-2 animate-spin" />
              Expanding...
            </>
          ) : (
            <>
              <Layers className="w-4 h-4 mr-2" />
              Expand Subgraph
            </>
          )}
        </Button>
      </div>

      {/* Inverse Topology Mapping */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 pb-2">
          <Label className="text-sm font-medium">Inverse Topology Mapping</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Connected wallets sorted by suspicion score
          </p>
        </div>

        <ScrollArea className="flex-1 px-4 pb-4">
          {inverseMapping.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No expansion data</p>
              <p className="text-xs mt-1">Add seeds and click "Expand Subgraph"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {inverseMapping.map(mapping => (
                <div key={mapping.seedAddress} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-mono text-muted-foreground">
                      From {formatAddress(mapping.seedAddress)}
                    </span>
                  </div>

                  <div className="space-y-1 ml-4">
                    {mapping.connectedWallets.slice(0, 10).map(wallet => (
                      <button
                        key={wallet.address}
                        onClick={() => onWalletClick(wallet.address)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-foreground">
                            {formatAddress(wallet.address)}
                          </span>
                          {getRelationshipBadge(wallet.relationship)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {wallet.hopDistance}hop
                          </span>
                          <span className={cn(
                            "text-xs font-bold",
                            wallet.suspicionScore >= 60 ? "text-suspicion-high" :
                            wallet.suspicionScore >= 30 ? "text-suspicion-medium" :
                            "text-suspicion-low"
                          )}>
                            {wallet.suspicionScore}
                          </span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                    {mapping.connectedWallets.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        +{mapping.connectedWallets.length - 10} more wallets
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
