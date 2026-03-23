import { useState, useEffect, useCallback, useMemo } from 'react';
import { parseCSV } from '@/lib/csvParser';
import { analyzeTransactions, getTopSuspiciousWallets } from '@/lib/smurfingDetector';
import { 
  calculateTemporalAttentionScore, 
  getTemporalPatterns, 
  generateTemporalHeatmap,
  getTimeRange,
  filterTransactionsByTime 
} from '@/lib/temporalAnalysis';
import { 
  expandSubgraph, 
  generateInverseMapping, 
  getDefaultExpansionConfig,
  createSeedFromWallet 
} from '@/lib/subgraphExpansion';
import { 
  Transaction, 
  WalletNode, 
  GraphData, 
  GraphNode,
  ViewMode,
  SubgraphExpansionConfig,
  InverseTopologyMapping,
  TemporalPattern,
  TemporalHeatmapData
} from '@/types/transaction';
import { TransactionGraph } from '@/components/TransactionGraph';
import { WalletPanel } from '@/components/WalletPanel';
import { TopSuspiciousList } from '@/components/TopSuspiciousList';
import { GraphLegend } from '@/components/GraphLegend';
import { ModeToolbar } from '@/components/ModeToolbar';
import { TimelineSlider } from '@/components/TimelineSlider';
import { ForensicPanel } from '@/components/ForensicPanel';
import { TemporalHeatmap } from '@/components/TemporalHeatmap';
import { ContextMenu } from '@/components/ContextMenu';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { toast } = useToast();
  
  // Core data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Map<string, WalletNode>>(new Map());
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedWallet, setSelectedWallet] = useState<WalletNode | null>(null);
  const [topSuspicious, setTopSuspicious] = useState<WalletNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalTx: 0, totalWallets: 0, highRiskCount: 0 });

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // Temporal state
  const [timeRange, setTimeRange] = useState({ min: 0, max: 1000 });
  const [currentTime, setCurrentTime] = useState(1000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showTemporalFlow, setShowTemporalFlow] = useState(true);
  const [temporalHeatmap, setTemporalHeatmap] = useState<TemporalHeatmapData[]>([]);
  const [selectedWalletPatterns, setSelectedWalletPatterns] = useState<TemporalPattern[]>([]);

  // Forensic Anchor state
  const [expansionConfig, setExpansionConfig] = useState<SubgraphExpansionConfig>(getDefaultExpansionConfig());
  const [subgraphData, setSubgraphData] = useState<GraphData | null>(null);
  const [inverseMapping, setInverseMapping] = useState<InverseTopologyMapping[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  // Computed
  const seedAddresses = useMemo(() => 
    new Set(expansionConfig.seeds.map(s => s.address)), 
    [expansionConfig.seeds]
  );

  const filteredTransactions = useMemo(() => {
    if (viewMode === 'overview') {
      return filterTransactionsByTime(transactions, timeRange.min, currentTime);
    }
    return transactions;
  }, [transactions, timeRange, currentTime, viewMode]);

  const displayGraphData = useMemo(() => {
    if (viewMode === 'forensic' && subgraphData) return subgraphData;
    return graphData;
  }, [viewMode, subgraphData, graphData]);

  const filteredCount = useMemo(() => filteredTransactions.length, [filteredTransactions]);

  // Load data — try backend first, fall back to CSV
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      let parsedTransactions: Transaction[];

      try {
        const apiRes = await fetch('/api/transactions');
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          parsedTransactions = apiData.transactions;
        } else {
          throw new Error('API unavailable');
        }
      } catch {
        // Fallback to CSV
        const response = await fetch('/data/dataset_small.csv');
        if (!response.ok) throw new Error('Failed to load transaction data');
        const csvText = await response.text();
        parsedTransactions = parseCSV(csvText);
      }

      const limitedTx = parsedTransactions.slice(0, 2000);
      setTransactions(limitedTx);

      const { wallets: analyzedWallets, graphData: analyzedGraph } = analyzeTransactions(limitedTx);

      // Temporal scores
      analyzedWallets.forEach((wallet) => {
        wallet.temporalAttentionScore = calculateTemporalAttentionScore(wallet, limitedTx);
        wallet.temporalPatterns = getTemporalPatterns(wallet, limitedTx);
      });

      analyzedGraph.nodes = analyzedGraph.nodes.map(node => ({
        ...node,
        wallet: analyzedWallets.get(node.id) || node.wallet
      }));

      setWallets(analyzedWallets);
      setGraphData(analyzedGraph);

      const range = getTimeRange(limitedTx);
      setTimeRange(range);
      setCurrentTime(range.max);

      setTemporalHeatmap(generateTemporalHeatmap(limitedTx, analyzedWallets));

      setTopSuspicious(getTopSuspiciousWallets(analyzedWallets, 10));

      const highRisk = Array.from(analyzedWallets.values()).filter(w => w.suspicionScore >= 60).length;
      setStats({
        totalTx: limitedTx.length,
        totalWallets: analyzedWallets.size,
        highRiskCount: highRisk,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Node handlers
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedWallet(node.wallet);
    if (node.wallet) {
      setSelectedWalletPatterns(getTemporalPatterns(node.wallet, transactions));
    }
  }, [transactions]);

  const handleNodeRightClick = useCallback((node: GraphNode, event: MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  }, []);

  const handleWalletClick = useCallback((wallet: WalletNode) => {
    setSelectedWallet(wallet);
    setSelectedWalletPatterns(getTemporalPatterns(wallet, transactions));
  }, [transactions]);

  const handleClosePanel = useCallback(() => {
    setSelectedWallet(null);
    setSelectedWalletPatterns([]);
  }, []);

  // Forensic seed management
  const handleSetAsSeed = useCallback(() => {
    if (!selectedWallet) return;
    if (expansionConfig.seeds.some(s => s.address === selectedWallet.address)) {
      toast({ title: "Already a seed", description: "This wallet is already set as a forensic anchor." });
      return;
    }
    const newSeed = createSeedFromWallet(selectedWallet);
    setExpansionConfig(prev => ({ ...prev, seeds: [...prev.seeds, newSeed] }));
    toast({ title: "Seed Added", description: `${selectedWallet.address.slice(0, 8)}... added as forensic anchor.` });
    setViewMode('forensic');
  }, [selectedWallet, expansionConfig.seeds, toast]);

  const handleRemoveSeed = useCallback((seedId: string) => {
    setExpansionConfig(prev => ({ ...prev, seeds: prev.seeds.filter(s => s.id !== seedId) }));
  }, []);

  const handleExpandSubgraph = useCallback(() => {
    if (expansionConfig.seeds.length === 0) return;
    setIsExpanding(true);
    setTimeout(() => {
      const expanded = expandSubgraph(expansionConfig, transactions, wallets);
      const mapping = generateInverseMapping(expanded, wallets, transactions);
      setSubgraphData({ nodes: expanded.nodes, links: expanded.links });
      setInverseMapping(mapping);
      setIsExpanding(false);
      toast({ title: "Subgraph Expanded", description: `Found ${expanded.nodes.length} nodes and ${expanded.links.length} connections.` });
    }, 500);
  }, [expansionConfig, transactions, wallets, toast]);

  // Flagging
  const handleFlagWallet = useCallback((flag: 'confirmed_laundering' | 'suspicious' | 'cleared') => {
    if (!selectedWallet) return;
    const updatedWallet = { ...selectedWallet, isManuallyFlagged: true, flaggedAs: flag };
    wallets.set(selectedWallet.address, updatedWallet);
    setSelectedWallet(updatedWallet);

    // Persist to backend
    fetch('/api/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: selectedWallet.address, flag }),
    }).catch(() => {}); // fire-and-forget

    toast({ title: "Wallet Flagged", description: `Marked as ${flag.replace('_', ' ')}.` });
  }, [selectedWallet, wallets, toast]);

  const handleInverseMappingClick = useCallback((address: string) => {
    const wallet = wallets.get(address);
    if (wallet) handleWalletClick(wallet);
  }, [wallets, handleWalletClick]);

  // Context menu actions
  const handleCopyAddress = useCallback(() => {
    if (contextMenu?.node) {
      navigator.clipboard.writeText(contextMenu.node.wallet.address);
      toast({ title: "Address copied!" });
    }
  }, [contextMenu, toast]);

  const handleViewOnEtherscan = useCallback(() => {
    if (contextMenu?.node) {
      window.open(`https://etherscan.io/address/${contextMenu.node.wallet.address}`, '_blank');
    }
  }, [contextMenu]);

  // Timeline
  const handleTimeChange = useCallback((time: number) => { setCurrentTime(time); }, []);
  const handleRangeChange = useCallback((_start: number, _end: number) => {}, []);
  const handlePlayPause = useCallback(() => { setIsPlaying(prev => !prev); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-lg text-foreground">Loading transaction data...</p>
          <p className="text-sm text-muted-foreground mt-2">Analyzing smurfing patterns</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-panel p-8 rounded-lg max-w-md">
          <AlertCircle className="w-12 h-12 text-suspicion-high mx-auto mb-4" />
          <p className="text-lg text-foreground mb-2">Error Loading Data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          <div className="flex items-center gap-3">
            <Search className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-gradient-cyber">The Smurfing Hunter</h1>
              <p className="text-xs text-muted-foreground">Advanced Blockchain AML Analysis Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="stat-label">Transactions</p>
              <p className="text-lg font-semibold text-foreground">{stats.totalTx.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="stat-label">Wallets</p>
              <p className="text-lg font-semibold text-foreground">{stats.totalWallets.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="stat-label">High Risk</p>
              <p className="text-lg font-semibold text-suspicion-high">{stats.highRiskCount}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mode Toolbar */}
      <ModeToolbar
        currentMode={viewMode}
        onModeChange={setViewMode}
        seedCount={expansionConfig.seeds.length}
      />

      {/* Timeline Slider */}
      {viewMode === 'overview' && (
        <TimelineSlider
          minTime={timeRange.min}
          maxTime={timeRange.max}
          currentTime={currentTime}
          onTimeChange={handleTimeChange}
          onRangeChange={handleRangeChange}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          playbackSpeed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          transactionCount={stats.totalTx}
          filteredCount={filteredCount}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Graph */}
        <div className="flex-1 flex flex-col p-4 min-w-0" style={{ flexBasis: '66.666%' }}>
          <div className="flex-1 relative">
            <TransactionGraph 
              data={displayGraphData}
              onNodeClick={handleNodeClick}
              onNodeRightClick={handleNodeRightClick}
              selectedNodeId={selectedWallet?.id || null}
              seedNodes={seedAddresses}
              currentTime={currentTime}
              timeRange={timeRange}
              showTemporalFlow={showTemporalFlow && viewMode === 'overview'}
              viewMode={viewMode}
            />
            <div className="absolute bottom-4 left-4">
              <GraphLegend />
            </div>
            {viewMode === 'overview' && (
              <div className="absolute top-4 right-4 w-80">
                <TemporalHeatmap data={temporalHeatmap} />
              </div>
            )}
          </div>
          {viewMode === 'overview' && (
            <div className="mt-4">
              <TopSuspiciousList 
                wallets={topSuspicious}
                onWalletClick={handleWalletClick}
                selectedWalletId={selectedWallet?.id || null}
              />
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-[400px] border-l border-border bg-card/50 overflow-auto">
          {viewMode === 'overview' && (
            <WalletPanel 
              wallet={selectedWallet}
              onClose={handleClosePanel}
              temporalPatterns={selectedWalletPatterns}
              onSetAsSeed={handleSetAsSeed}
              onFlagWallet={handleFlagWallet}
            />
          )}
          {viewMode === 'forensic' && (
            <ForensicPanel
              config={expansionConfig}
              onConfigChange={setExpansionConfig}
              inverseMapping={inverseMapping}
              selectedWallet={selectedWallet}
              onAddSeed={handleSetAsSeed}
              onRemoveSeed={handleRemoveSeed}
              onWalletClick={handleInverseMappingClick}
              onExpand={handleExpandSubgraph}
              isExpanding={isExpanding}
              timeRange={timeRange}
            />
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          walletAddress={contextMenu.node.wallet.address}
          onClose={() => setContextMenu(null)}
          onSetAsSeed={() => {
            setSelectedWallet(contextMenu.node.wallet);
            handleSetAsSeed();
          }}
          onFlagAsLaundering={() => {
            setSelectedWallet(contextMenu.node.wallet);
            handleFlagWallet('confirmed_laundering');
          }}
          onFlagAsSuspicious={() => {
            setSelectedWallet(contextMenu.node.wallet);
            handleFlagWallet('suspicious');
          }}
          onFlagAsCleared={() => {
            setSelectedWallet(contextMenu.node.wallet);
            handleFlagWallet('cleared');
          }}
          onCopyAddress={handleCopyAddress}
          onViewOnEtherscan={handleViewOnEtherscan}
        />
      )}
    </div>
  );
};

export default Index;
