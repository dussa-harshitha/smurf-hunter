import {
  Transaction,
  WalletNode,
  GraphNode,
  GraphLink,
  SeedWallet,
  SubgraphExpansionConfig,
  SubgraphData,
  SubgraphNode,
  SubgraphLink,
  InverseTopologyMapping
} from '@/types/transaction';
import { getSuspicionColor } from './smurfingDetector';

/**
 * Expand subgraph from seed wallets using K-hop expansion
 */
export function expandSubgraph(
  config: SubgraphExpansionConfig,
  transactions: Transaction[],
  wallets: Map<string, WalletNode>
): SubgraphData {
  const { seeds, kHops, timeRange, entityTypeFilter, minValueThreshold, expansionDirection } = config;

  if (seeds.length === 0) {
    return { nodes: [], links: [], seeds: [] };
  }

  // Filter transactions by config
  let filteredTxs = transactions.filter(tx => tx.Value_ETH >= minValueThreshold);

  if (timeRange) {
    filteredTxs = filteredTxs.filter(
      tx => tx.Age_seconds >= timeRange.start && tx.Age_seconds <= timeRange.end
    );
  }

  if (entityTypeFilter.length > 0) {
    filteredTxs = filteredTxs.filter(
      tx => entityTypeFilter.includes(tx.From_entity_type) || 
            entityTypeFilter.includes(tx.To_entity_type)
    );
  }

  // Build adjacency lists
  const forwardEdges = new Map<string, Set<string>>(); // from -> [to]
  const backwardEdges = new Map<string, Set<string>>(); // to -> [from]
  const edgeTransactions = new Map<string, Transaction[]>(); // "from->to" -> [txs]

  filteredTxs.forEach(tx => {
    // Forward edges
    if (!forwardEdges.has(tx.From)) {
      forwardEdges.set(tx.From, new Set());
    }
    forwardEdges.get(tx.From)!.add(tx.To);

    // Backward edges
    if (!backwardEdges.has(tx.To)) {
      backwardEdges.set(tx.To, new Set());
    }
    backwardEdges.get(tx.To)!.add(tx.From);

    // Edge transactions
    const edgeKey = `${tx.From}->${tx.To}`;
    if (!edgeTransactions.has(edgeKey)) {
      edgeTransactions.set(edgeKey, []);
    }
    edgeTransactions.get(edgeKey)!.push(tx);
  });

  // BFS expansion from seeds
  const visitedNodes = new Map<string, { distance: number; path: string[] }>();
  const subgraphLinks: SubgraphLink[] = [];
  const queue: { address: string; distance: number; path: string[] }[] = [];

  // Initialize with seeds
  seeds.forEach(seed => {
    visitedNodes.set(seed.address, { distance: 0, path: [seed.address] });
    queue.push({ address: seed.address, distance: 0, path: [seed.address] });
  });

  // BFS
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.distance >= kHops) continue;

    const neighbors: { address: string; direction: 'forward' | 'backward' }[] = [];

    // Get neighbors based on direction
    if (expansionDirection === 'forward' || expansionDirection === 'bidirectional') {
      const forward = forwardEdges.get(current.address);
      if (forward) {
        forward.forEach(addr => neighbors.push({ address: addr, direction: 'forward' }));
      }
    }

    if (expansionDirection === 'backward' || expansionDirection === 'bidirectional') {
      const backward = backwardEdges.get(current.address);
      if (backward) {
        backward.forEach(addr => neighbors.push({ address: addr, direction: 'backward' }));
      }
    }

    // Process neighbors
    neighbors.forEach(({ address, direction }) => {
      const newDistance = current.distance + 1;
      const newPath = [...current.path, address];

      if (!visitedNodes.has(address) || visitedNodes.get(address)!.distance > newDistance) {
        visitedNodes.set(address, { distance: newDistance, path: newPath });
        queue.push({ address, distance: newDistance, path: newPath });
      }

      // Add link
      const edgeKey = direction === 'forward' 
        ? `${current.address}->${address}`
        : `${address}->${current.address}`;
      
      const txs = edgeTransactions.get(edgeKey) || [];
      if (txs.length > 0) {
        const totalValue = txs.reduce((sum, tx) => sum + tx.Value_ETH, 0);
        const minAge = Math.min(...txs.map(tx => tx.Age_seconds));

        // Check if link already exists
        const linkExists = subgraphLinks.some(
          l => (l.source === current.address && l.target === address) ||
               (l.source === address && l.target === current.address && direction === 'backward')
        );

        if (!linkExists) {
          subgraphLinks.push({
            source: direction === 'forward' ? current.address : address,
            target: direction === 'forward' ? address : current.address,
            value: totalValue,
            age: minAge,
            txHash: txs[0].TxHash,
            isInSubgraph: true,
            direction
          });
        }
      }
    });
  }

  // Build nodes
  const subgraphNodes: SubgraphNode[] = [];
  const seedAddresses = new Set(seeds.map(s => s.address));

  visitedNodes.forEach((info, address) => {
    const wallet = wallets.get(address);
    if (wallet) {
      const isSeed = seedAddresses.has(address);
      subgraphNodes.push({
        id: address,
        val: isSeed ? 15 : Math.max(5, Math.sqrt(wallet.totalSent + wallet.totalReceived) * 2),
        color: isSeed ? '#f59e0b' : getSuspicionColor(wallet.suspicionScore),
        wallet,
        hopDistance: info.distance,
        pathFromSeed: info.path,
        isSeed
      });
    }
  });

  return {
    nodes: subgraphNodes,
    links: subgraphLinks,
    seeds
  };
}

/**
 * Generate inverse topology mapping for seeds
 */
export function generateInverseMapping(
  subgraphData: SubgraphData,
  wallets: Map<string, WalletNode>,
  transactions: Transaction[]
): InverseTopologyMapping[] {
  const mappings: InverseTopologyMapping[] = [];

  subgraphData.seeds.forEach(seed => {
    const connectedWallets: InverseTopologyMapping['connectedWallets'] = [];

    // Find all nodes connected to this seed
    subgraphData.nodes.forEach(node => {
      if (node.id === seed.address) return;

      // Determine relationship
      const sendsToSeed = subgraphData.links.some(
        l => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
          const targetId = typeof l.target === 'string' ? l.target : l.target.id;
          return sourceId === node.id && targetId === seed.address;
        }
      );
      
      const receivesFromSeed = subgraphData.links.some(
        l => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
          const targetId = typeof l.target === 'string' ? l.target : l.target.id;
          return sourceId === seed.address && targetId === node.id;
        }
      );

      let relationship: 'sends_to' | 'receives_from' | 'bidirectional';
      if (sendsToSeed && receivesFromSeed) {
        relationship = 'bidirectional';
      } else if (sendsToSeed) {
        relationship = 'sends_to';
      } else {
        relationship = 'receives_from';
      }

      // Calculate total value and tx count
      const relevantTxs = transactions.filter(tx => 
        (tx.From === node.id && tx.To === seed.address) ||
        (tx.From === seed.address && tx.To === node.id)
      );

      const totalValue = relevantTxs.reduce((sum, tx) => sum + tx.Value_ETH, 0);
      const wallet = wallets.get(node.id);

      connectedWallets.push({
        address: node.id,
        relationship,
        hopDistance: node.hopDistance,
        totalValue,
        txCount: relevantTxs.length,
        suspicionScore: wallet?.suspicionScore || 0
      });
    });

    // Sort by suspicion score descending
    connectedWallets.sort((a, b) => b.suspicionScore - a.suspicionScore);

    mappings.push({
      seedAddress: seed.address,
      connectedWallets
    });
  });

  return mappings;
}

/**
 * Get default expansion config
 */
export function getDefaultExpansionConfig(): SubgraphExpansionConfig {
  return {
    seeds: [],
    kHops: 2,
    timeRange: null,
    entityTypeFilter: [],
    minValueThreshold: 0,
    expansionDirection: 'bidirectional'
  };
}

/**
 * Create a seed wallet from a wallet node
 */
export function createSeedFromWallet(wallet: WalletNode, label?: string): SeedWallet {
  const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981'];
  const colorIndex = Math.floor(Math.random() * colors.length);
  
  return {
    id: wallet.id,
    address: wallet.address,
    label: label || `Seed ${wallet.address.slice(0, 6)}`,
    addedAt: Date.now(),
    color: colors[colorIndex]
  };
}
