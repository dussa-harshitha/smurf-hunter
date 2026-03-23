import { 
  Transaction, 
  WalletNode, 
  TemporalPattern, 
  TemporalHeatmapData,
  GraphLink 
} from '@/types/transaction';

const BURST_THRESHOLD_SECONDS = 30;
const BURST_MIN_COUNT = 3;
const PERIODIC_VARIANCE_THRESHOLD = 0.15;
const RAPID_SEQUENCE_THRESHOLD = 5;

/**
 * Calculate temporal attention score for a wallet
 */
export function calculateTemporalAttentionScore(
  wallet: WalletNode,
  transactions: Transaction[]
): number {
  const walletTxs = transactions.filter(
    tx => tx.From === wallet.address || tx.To === wallet.address
  );

  if (walletTxs.length < 2) return 0;

  let score = 0;

  const sortedTxs = [...walletTxs].sort((a, b) => b.Age_seconds - a.Age_seconds);
  const times = sortedTxs.map(tx => tx.Age_seconds);

  const bursts = detectBursts(times);
  score += Math.min(30, bursts.length * 10);

  const periodicityScore = detectPeriodicity(times);
  score += periodicityScore;

  const timeConcentrationScore = detectTimeConcentration(sortedTxs);
  score += timeConcentrationScore;

  const rapidSequences = detectRapidSequences(times);
  score += Math.min(20, rapidSequences * 5);

  return Math.min(100, score);
}

function detectBursts(times: number[]): { start: number; end: number; count: number }[] {
  const bursts: { start: number; end: number; count: number }[] = [];
  let burstStart = 0;
  let burstCount = 1;

  for (let i = 1; i < times.length; i++) {
    const gap = Math.abs(times[i] - times[i - 1]);
    if (gap <= BURST_THRESHOLD_SECONDS) {
      burstCount++;
    } else {
      if (burstCount >= BURST_MIN_COUNT) {
        bursts.push({ start: times[burstStart], end: times[i - 1], count: burstCount });
      }
      burstStart = i;
      burstCount = 1;
    }
  }
  if (burstCount >= BURST_MIN_COUNT) {
    bursts.push({ start: times[burstStart], end: times[times.length - 1], count: burstCount });
  }
  return bursts;
}

function detectPeriodicity(times: number[]): number {
  if (times.length < 3) return 0;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(Math.abs(times[i] - times[i - 1]));
  }
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avgGap === 0) return 0;
  const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
  const cv = Math.sqrt(variance) / avgGap;
  if (cv < 0.05) return 25;
  if (cv < 0.1) return 15;
  if (cv < PERIODIC_VARIANCE_THRESHOLD) return 8;
  return 0;
}

function detectTimeConcentration(transactions: Transaction[]): number {
  const hourBuckets = new Array(24).fill(0);
  transactions.forEach(tx => {
    const pseudoHour = Math.floor((tx.Age_seconds % 86400) / 3600);
    hourBuckets[pseudoHour]++;
  });
  const totalTx = transactions.length;
  const maxInBucket = Math.max(...hourBuckets);
  const concentration = maxInBucket / totalTx;
  if (concentration > 0.7) return 15;
  if (concentration > 0.5) return 10;
  if (concentration > 0.3) return 5;
  return 0;
}

function detectRapidSequences(times: number[]): number {
  let rapidCount = 0;
  for (let i = 1; i < times.length; i++) {
    if (Math.abs(times[i] - times[i - 1]) <= RAPID_SEQUENCE_THRESHOLD) {
      rapidCount++;
    }
  }
  return rapidCount;
}

/**
 * Get temporal patterns for a wallet
 */
export function getTemporalPatterns(
  wallet: WalletNode,
  transactions: Transaction[]
): TemporalPattern[] {
  const patterns: TemporalPattern[] = [];
  const walletTxs = transactions.filter(
    tx => tx.From === wallet.address || tx.To === wallet.address
  );
  if (walletTxs.length < 2) return patterns;

  const sortedTxs = [...walletTxs].sort((a, b) => b.Age_seconds - a.Age_seconds);
  const times = sortedTxs.map(tx => tx.Age_seconds);

  const bursts = detectBursts(times);
  bursts.forEach(burst => {
    patterns.push({
      type: 'burst',
      description: `${burst.count} transactions within ${Math.abs(burst.end - burst.start)}s`,
      severity: burst.count >= 5 ? 'high' : burst.count >= 3 ? 'medium' : 'low',
      timeRange: { start: burst.start, end: burst.end },
      involvedTransactions: sortedTxs
        .filter(tx => tx.Age_seconds >= Math.min(burst.start, burst.end) && 
                      tx.Age_seconds <= Math.max(burst.start, burst.end))
        .map(tx => tx.TxHash)
    });
  });

  if (times.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) {
      gaps.push(Math.abs(times[i] - times[i - 1]));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
    const cv = Math.sqrt(variance) / (avgGap || 1);

    if (cv < PERIODIC_VARIANCE_THRESHOLD && avgGap < 600) {
      patterns.push({
        type: 'periodic',
        description: `Regular interval: ~${avgGap.toFixed(0)}s between transactions (CV: ${(cv * 100).toFixed(1)}%)`,
        severity: cv < 0.05 ? 'high' : cv < 0.1 ? 'medium' : 'low',
        timeRange: { start: Math.min(...times), end: Math.max(...times) },
        involvedTransactions: sortedTxs.map(tx => tx.TxHash)
      });
    }
  }

  let rapidStart = -1;
  let rapidTxs: string[] = [];
  for (let i = 1; i < times.length; i++) {
    const gap = Math.abs(times[i] - times[i - 1]);
    if (gap <= RAPID_SEQUENCE_THRESHOLD) {
      if (rapidStart === -1) {
        rapidStart = times[i - 1];
        rapidTxs = [sortedTxs[i - 1].TxHash];
      }
      rapidTxs.push(sortedTxs[i].TxHash);
    } else if (rapidTxs.length >= 2) {
      patterns.push({
        type: 'rapid_sequence',
        description: `${rapidTxs.length} transactions in rapid succession (<${RAPID_SEQUENCE_THRESHOLD}s apart)`,
        severity: rapidTxs.length >= 5 ? 'high' : 'medium',
        timeRange: { start: rapidStart, end: times[i - 1] },
        involvedTransactions: rapidTxs
      });
      rapidStart = -1;
      rapidTxs = [];
    }
  }

  return patterns;
}

/**
 * Generate meaningful temporal heatmap data.
 * Buckets transactions chronologically and computes per-bucket stats.
 */
export function generateTemporalHeatmap(
  transactions: Transaction[],
  wallets: Map<string, WalletNode>,
  numBuckets: number = 30
): TemporalHeatmapData[] {
  if (transactions.length === 0) return [];

  const sorted = [...transactions].sort((a, b) => b.Age_seconds - a.Age_seconds);
  const minAge = sorted[sorted.length - 1].Age_seconds;
  const maxAge = sorted[0].Age_seconds;
  const range = maxAge - minAge || 1;
  const bucketSize = range / numBuckets;

  const buckets: TemporalHeatmapData[] = Array.from({ length: numBuckets }, (_, i) => ({
    bucket: i,
    intensity: 0,
    txCount: 0,
    totalValue: 0,
    avgSuspicion: 0,
  }));

  const suspicionAccum: number[][] = Array.from({ length: numBuckets }, () => []);

  sorted.forEach(tx => {
    const bucketIdx = Math.min(
      numBuckets - 1,
      Math.floor((tx.Age_seconds - minAge) / bucketSize)
    );
    buckets[bucketIdx].txCount++;
    buckets[bucketIdx].totalValue += tx.Value_ETH;

    // Collect suspicion scores from sender wallet
    const senderWallet = wallets.get(tx.From);
    if (senderWallet) {
      suspicionAccum[bucketIdx].push(senderWallet.suspicionScore);
    }
  });

  const maxCount = Math.max(...buckets.map(b => b.txCount), 1);
  buckets.forEach((b, i) => {
    b.intensity = b.txCount / maxCount;
    const scores = suspicionAccum[i];
    b.avgSuspicion = scores.length > 0
      ? scores.reduce((a, c) => a + c, 0) / scores.length
      : 0;
  });

  return buckets;
}

export function getTimeRange(transactions: Transaction[]): { min: number; max: number } {
  if (transactions.length === 0) return { min: 0, max: 0 };
  const ages = transactions.map(tx => tx.Age_seconds);
  return { min: Math.min(...ages), max: Math.max(...ages) };
}

export function filterTransactionsByTime(
  transactions: Transaction[],
  minTime: number,
  maxTime: number
): Transaction[] {
  return transactions.filter(tx => tx.Age_seconds >= minTime && tx.Age_seconds <= maxTime);
}

export function sortLinksByTime(links: GraphLink[], transactions: Transaction[]): GraphLink[] {
  const txAgeMap = new Map<string, number>();
  transactions.forEach(tx => txAgeMap.set(tx.TxHash, tx.Age_seconds));
  return [...links]
    .map((link, idx) => ({
      ...link,
      temporalIndex: idx,
      sortAge: txAgeMap.get(link.txHash) || 0
    }))
    .sort((a, b) => b.sortAge - a.sortAge)
    .map((link, idx) => ({
      ...link,
      temporalIndex: idx
    }));
}
