import { Transaction, WalletNode, GraphData, GraphNode, GraphLink, SuspicionLevel } from '@/types/transaction';

const FAN_OUT_THRESHOLD = 5; // Sending to 5+ unique wallets
const FAN_IN_THRESHOLD = 5;  // Receiving from 5+ unique wallets
const PEELING_VALUE_DECREASE = 0.15; // 15% decrease threshold
const TIME_CLUSTER_THRESHOLD = 60; // seconds
const SUSPICIOUS_RHYTHM_VARIANCE = 0.1; // 10% variance = suspicious regularity
const HIGHLY_SUSPICIOUS_RHYTHM_VARIANCE = 0.05;

export function analyzeTransactions(transactions: Transaction[]): {
  wallets: Map<string, WalletNode>;
  graphData: GraphData;
} {
  const walletMap = new Map<string, WalletNode>();
  const transactionsByWallet = new Map<string, Transaction[]>();
  const outgoingEdges = new Map<string, Set<string>>();
  const incomingEdges = new Map<string, Set<string>>();
  
  // First pass: collect wallet data
  for (const tx of transactions) {
    // Track outgoing edges
    if (!outgoingEdges.has(tx.From)) {
      outgoingEdges.set(tx.From, new Set());
    }
    outgoingEdges.get(tx.From)!.add(tx.To);
    
    // Track incoming edges
    if (!incomingEdges.has(tx.To)) {
      incomingEdges.set(tx.To, new Set());
    }
    incomingEdges.get(tx.To)!.add(tx.From);
    
    // Track transactions by wallet
    if (!transactionsByWallet.has(tx.From)) {
      transactionsByWallet.set(tx.From, []);
    }
    transactionsByWallet.get(tx.From)!.push(tx);
    
    // Initialize wallets
    if (!walletMap.has(tx.From)) {
      walletMap.set(tx.From, createEmptyWallet(tx.From, tx.From_entity_type));
    }
    if (!walletMap.has(tx.To)) {
      walletMap.set(tx.To, createEmptyWallet(tx.To, tx.To_entity_type));
    }
    
    // Update totals
    const fromWallet = walletMap.get(tx.From)!;
    fromWallet.totalSent += tx.Value_ETH;
    fromWallet.outgoingCount++;
    fromWallet.txCount = Math.max(fromWallet.txCount, tx.From_tx_count);
    
    const toWallet = walletMap.get(tx.To)!;
    toWallet.totalReceived += tx.Value_ETH;
    toWallet.incomingCount++;
    toWallet.txCount = Math.max(toWallet.txCount, tx.To_tx_count);
  }
  
  // Second pass: detect patterns and calculate suspicion scores
  for (const [address, wallet] of walletMap) {
    const reasons: string[] = [];
    let score = 0;
    
    const outCount = outgoingEdges.get(address)?.size || 0;
    const inCount = incomingEdges.get(address)?.size || 0;
    
    // Fan-out detection
    if (outCount >= FAN_OUT_THRESHOLD) {
      wallet.participatesInFanOut = true;
      reasons.push(`Sends to ${outCount} unique wallets (fan-out pattern)`);
      score += Math.min(30, outCount * 3);
    }
    
    // Fan-in detection
    if (inCount >= FAN_IN_THRESHOLD) {
      wallet.participatesInFanIn = true;
      reasons.push(`Receives from ${inCount} unique wallets (fan-in pattern)`);
      score += Math.min(30, inCount * 3);
    }
    
    // Peeling chain detection
    const walletTxs = transactionsByWallet.get(address) || [];
    if (walletTxs.length >= 3) {
      const values = walletTxs.map(tx => tx.Value_ETH).sort((a, b) => b - a);
      let peelingCount = 0;
      for (let i = 1; i < values.length; i++) {
        const decrease = (values[i - 1] - values[i]) / values[i - 1];
        if (decrease > 0 && decrease < PEELING_VALUE_DECREASE) {
          peelingCount++;
        }
      }
      if (peelingCount >= 2) {
        wallet.isPeelingSource = true;
        reasons.push(`${peelingCount} transactions show gradual value decrease (peeling chain)`);
        score += Math.min(25, peelingCount * 5);
      }
    }
    
    // Time clustering detection
    const txTimes = walletTxs.map(tx => tx.Age_seconds).sort((a, b) => a - b);
    let clusterCount = 0;
    for (let i = 1; i < txTimes.length; i++) {
      if (Math.abs(txTimes[i] - txTimes[i - 1]) < TIME_CLUSTER_THRESHOLD) {
        clusterCount++;
      }
    }
    if (clusterCount >= 3) {
      reasons.push(`${clusterCount} transactions clustered within ${TIME_CLUSTER_THRESHOLD}s`);
      score += Math.min(20, clusterCount * 4);
    }
    
    // High Fee_to_Value detection
    const highFeeCount = walletTxs.filter(tx => tx.Fee_to_Value > 0.01).length;
    if (highFeeCount >= 2) {
      reasons.push(`${highFeeCount} transactions with unusually high fee-to-value ratio`);
      score += Math.min(15, highFeeCount * 3);
    }
    
    // High transaction count
    if (wallet.txCount > 100) {
      score += Math.min(10, Math.floor(wallet.txCount / 50));
    }
    
    // Transaction rhythm analysis
    if (txTimes.length >= 3) {
      const gaps: number[] = [];
      for (let i = 1; i < txTimes.length; i++) {
        gaps.push(txTimes[i] - txTimes[i - 1]);
      }
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
      const coefficientOfVariation = Math.sqrt(variance) / (avgGap || 1);
      
      wallet.avgTimeBetweenTx = avgGap;
      
      if (coefficientOfVariation < HIGHLY_SUSPICIOUS_RHYTHM_VARIANCE && avgGap < 300) {
        wallet.transactionRhythm = 'highly_suspicious';
        wallet.rhythmDescription = `Highly regular timing pattern (CV: ${(coefficientOfVariation * 100).toFixed(1)}%, avg gap: ${avgGap.toFixed(0)}s)`;
        reasons.push('Highly suspicious automated transaction pattern detected');
        score += 20;
      } else if (coefficientOfVariation < SUSPICIOUS_RHYTHM_VARIANCE && avgGap < 600) {
        wallet.transactionRhythm = 'suspicious';
        wallet.rhythmDescription = `Suspiciously coordinated timing (CV: ${(coefficientOfVariation * 100).toFixed(1)}%, avg gap: ${avgGap.toFixed(0)}s)`;
        reasons.push('Unusually regular transaction timing');
        score += 10;
      } else {
        wallet.transactionRhythm = 'normal';
        wallet.rhythmDescription = 'Normal activity patterns';
      }
    }
    
    wallet.suspicionScore = Math.min(100, score);
    wallet.suspicionReasons = reasons;
  }
  
  // Build graph data
  const graphData = buildGraphData(transactions, walletMap);
  
  return { wallets: walletMap, graphData };
}

function createEmptyWallet(address: string, entityType: string): WalletNode {
  return {
    id: address,
    address,
    totalSent: 0,
    totalReceived: 0,
    outgoingCount: 0,
    incomingCount: 0,
    suspicionScore: 0,
    suspicionReasons: [],
    transactionRhythm: 'normal',
    rhythmDescription: 'Insufficient data',
    entityType: entityType || 'unknown',
    avgTimeBetweenTx: 0,
    participatesInFanOut: false,
    participatesInFanIn: false,
    isPeelingSource: false,
    txCount: 0,
  };
}

function buildGraphData(transactions: Transaction[], walletMap: Map<string, WalletNode>): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seenNodes = new Set<string>();
  const edgeMap = new Map<string, { value: number; ages: number[]; txHashes: string[] }>();
  
  // Aggregate edges between same pairs
  for (const tx of transactions) {
    const edgeKey = `${tx.From}->${tx.To}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, { value: 0, ages: [], txHashes: [] });
    }
    const edge = edgeMap.get(edgeKey)!;
    edge.value += tx.Value_ETH;
    edge.ages.push(tx.Age_seconds);
    edge.txHashes.push(tx.TxHash);
  }
  
  // Create links
  for (const [key, data] of edgeMap) {
    const [from, to] = key.split('->');
    links.push({
      source: from,
      target: to,
      value: data.value,
      age: Math.min(...data.ages),
      txHash: data.txHashes[0],
    });
    seenNodes.add(from);
    seenNodes.add(to);
  }
  
  // Create nodes
  for (const address of seenNodes) {
    const wallet = walletMap.get(address);
    if (wallet) {
      nodes.push({
        id: address,
        val: Math.max(3, Math.sqrt(wallet.totalSent + wallet.totalReceived) * 2),
        color: getSuspicionColor(wallet.suspicionScore),
        wallet,
      });
    }
  }
  
  return { nodes, links };
}

export function getSuspicionColor(score: number): string {
  if (score < 30) return 'hsl(142, 70%, 45%)'; // Green
  if (score < 60) return 'hsl(45, 90%, 50%)';  // Yellow
  return 'hsl(0, 70%, 55%)';                    // Red
}

export function getSuspicionLevel(score: number): SuspicionLevel {
  if (score < 30) return 'low';
  if (score < 60) return 'medium';
  return 'high';
}

export function getTopSuspiciousWallets(wallets: Map<string, WalletNode>, count: number = 10): WalletNode[] {
  return Array.from(wallets.values())
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .slice(0, count);
}
