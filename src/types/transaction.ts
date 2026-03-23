export interface Transaction {
  Record: number;
  TxHash: string;
  Block: number;
  From: string;
  To: string;
  Value_ETH: number;
  TxFee: number;
  Age_seconds: number;
  From_is_address: boolean;
  To_is_address: boolean;
  From_entity_type: string;
  To_entity_type: string;
  Fee_to_Value: number;
  Value_Wei: string;
  From_tx_count: number;
  To_tx_count: number;
}

export interface WalletNode {
  id: string;
  address: string;
  totalSent: number;
  totalReceived: number;
  outgoingCount: number;
  incomingCount: number;
  suspicionScore: number;
  suspicionReasons: string[];
  transactionRhythm: 'normal' | 'suspicious' | 'highly_suspicious';
  rhythmDescription: string;
  entityType: string;
  avgTimeBetweenTx: number;
  participatesInFanOut: boolean;
  participatesInFanIn: boolean;
  isPeelingSource: boolean;
  txCount: number;
  // Temporal
  temporalAttentionScore?: number;
  temporalPatterns?: TemporalPattern[];
  firstSeen?: number;
  lastSeen?: number;
  // Manual flagging (used in forensic mode)
  isManuallyFlagged?: boolean;
  flaggedAs?: 'confirmed_laundering' | 'suspicious' | 'cleared';
}

export interface GraphNode {
  id: string;
  val: number;
  color: string;
  wallet: WalletNode;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  age: number;
  txHash: string;
  temporalIndex?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type SuspicionLevel = 'low' | 'medium' | 'high';

// ==========================================
// Temporal Pattern Types
// ==========================================

export interface TemporalPattern {
  type: 'burst' | 'periodic' | 'delayed' | 'rapid_sequence' | 'time_zone_anomaly';
  description: string;
  severity: 'low' | 'medium' | 'high';
  timeRange: { start: number; end: number };
  involvedTransactions: string[];
}

export interface TemporalHeatmapData {
  bucket: number;       // time bucket index
  intensity: number;    // normalized 0-1
  txCount: number;
  totalValue: number;
  avgSuspicion: number;
}

// ==========================================
// Seed-Driven Subgraph Expansion Types
// ==========================================

export interface SeedWallet {
  id: string;
  address: string;
  label?: string;
  addedAt: number;
  color?: string;
}

export interface SubgraphExpansionConfig {
  seeds: SeedWallet[];
  kHops: number;
  timeRange: { start: number; end: number } | null;
  entityTypeFilter: string[];
  minValueThreshold: number;
  expansionDirection: 'forward' | 'backward' | 'bidirectional';
}

export interface SubgraphNode extends GraphNode {
  hopDistance: number;
  pathFromSeed: string[];
  isSeed: boolean;
}

export interface SubgraphLink extends GraphLink {
  isInSubgraph: boolean;
  direction: 'forward' | 'backward';
}

export interface SubgraphData {
  nodes: SubgraphNode[];
  links: SubgraphLink[];
  seeds: SeedWallet[];
}

export interface InverseTopologyMapping {
  seedAddress: string;
  connectedWallets: {
    address: string;
    relationship: 'sends_to' | 'receives_from' | 'bidirectional';
    hopDistance: number;
    totalValue: number;
    txCount: number;
    suspicionScore: number;
  }[];
}

// ==========================================
// UI State Types
// ==========================================

export type ViewMode = 'overview' | 'forensic';
