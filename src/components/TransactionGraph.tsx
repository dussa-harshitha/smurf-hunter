import { useCallback, useRef, useEffect, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { GraphData, GraphNode, SubgraphNode, ViewMode } from '@/types/transaction';

interface TransactionGraphProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  onNodeRightClick?: (node: GraphNode, event: MouseEvent) => void;
  selectedNodeId: string | null;
  highlightedNodes?: Set<string>;
  seedNodes?: Set<string>;
  currentTime?: number;
  timeRange?: { min: number; max: number };
  showTemporalFlow?: boolean;
  viewMode?: ViewMode;
}

export function TransactionGraph({ 
  data, 
  onNodeClick, 
  onNodeRightClick,
  selectedNodeId,
  highlightedNodes,
  seedNodes,
  currentTime,
  timeRange,
  showTemporalFlow = false,
  viewMode = 'overview'
}: TransactionGraphProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, any>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const animationPhase = useRef(0);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-150);
      graphRef.current.d3Force('link')?.distance(80);
    }
  }, [data]);

  // Animation loop for temporal flow
  useEffect(() => {
    if (!showTemporalFlow) return;
    
    const animate = () => {
      animationPhase.current = (animationPhase.current + 0.02) % 1;
      if (graphRef.current) {
        graphRef.current.refresh();
      }
    };
    
    const interval = setInterval(animate, 50);
    return () => clearInterval(interval);
  }, [showTemporalFlow]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    onNodeClick(node);
    
    if (graphRef.current) {
      const nodeWithCoords = node as GraphNode & { x?: number; y?: number };
      graphRef.current.centerAt(nodeWithCoords.x, nodeWithCoords.y, 500);
      graphRef.current.zoom(2, 500);
    }
  }, [onNodeClick]);

  const handleNodeRightClick = useCallback((node: GraphNode, event: MouseEvent) => {
    event.preventDefault();
    if (onNodeRightClick) {
      onNodeRightClick(node, event);
    }
  }, [onNodeRightClick]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphNode = node as GraphNode;
    const subgraphNode = node as SubgraphNode;
    let size = graphNode.val || 5;
    const isSelected = graphNode.id === selectedNodeId;
    const isHighlighted = highlightedNodes?.has(graphNode.id);
    const isSeed = seedNodes?.has(graphNode.id) || (subgraphNode as any).isSeed;
    
    // Temporal attention indicator (pulsing ring for high attention)
    const attentionScore = graphNode.wallet.temporalAttentionScore || 0;
    if (attentionScore > 50 && showTemporalFlow) {
      const pulseSize = size + 8 + Math.sin(animationPhase.current * Math.PI * 2) * 4;
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseSize, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + Math.sin(animationPhase.current * Math.PI * 2) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Seed node special rendering
    if (isSeed) {
      size = Math.max(size, 12);
      // Outer glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.fill();
      // Inner ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Highlight glow
    if (isHighlighted && !isSeed) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.fill();
    }
    
    // Glow effect for selected or high suspicion
    if (isSelected || graphNode.wallet.suspicionScore >= 60) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected 
        ? 'rgba(34, 211, 238, 0.3)' 
        : graphNode.wallet.suspicionScore >= 60 
          ? 'rgba(239, 68, 68, 0.3)' 
          : 'rgba(234, 179, 8, 0.2)';
      ctx.fill();
    }

    // Main node
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = isSeed ? '#f59e0b' : graphNode.color;
    ctx.fill();

    // Border for selected
    if (isSelected) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Hop distance indicator for forensic mode
    const hopDistance = (subgraphNode as any).hopDistance;
    if (viewMode === 'forensic' && hopDistance !== undefined && !isSeed) {
      const hopLabel = hopDistance.toString();
      ctx.font = `bold ${Math.max(8, size * 0.8)}px JetBrains Mono`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(hopLabel, node.x, node.y);
    }

    // Temporal attention score badge
    if (showTemporalFlow && attentionScore > 30) {
      const badgeX = node.x + size + 2;
      const badgeY = node.y - size - 2;
      ctx.font = 'bold 8px JetBrains Mono';
      ctx.fillStyle = attentionScore >= 70 ? '#ef4444' : attentionScore >= 50 ? '#f59e0b' : '#eab308';
      ctx.fillText(`⚡${attentionScore}`, badgeX, badgeY);
    }

    // Label for high suspicion or selected nodes
    if ((globalScale > 1.5 && graphNode.wallet.suspicionScore >= 40) || isSelected || isSeed) {
      const label = graphNode.wallet.address.slice(0, 6) + '...' + graphNode.wallet.address.slice(-4);
      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${fontSize}px JetBrains Mono`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(label, node.x, node.y + size + fontSize + 2);
    }
  }, [selectedNodeId, highlightedNodes, seedNodes, showTemporalFlow, viewMode]);

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = { x: link.source.x, y: link.source.y };
    const end = { x: link.target.x, y: link.target.y };
    
    // Calculate line width based on value
    const lineWidth = Math.max(0.5, Math.min(5, Math.sqrt(link.value) * 0.5));
    
    // Calculate opacity based on age and current time filter
    let opacity = Math.max(0.2, 1 - (link.age / 10000));
    
    // Temporal filtering - dim edges outside current time
    if (currentTime !== undefined && timeRange) {
      const edgeAge = link.age;
      if (edgeAge < currentTime) {
        opacity *= 0.2; // Dim future edges
      }
    }
    
    // Animated flow effect for temporal visualization
    if (showTemporalFlow) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      
      // Draw animated particles along the edge
      const particlePos = (animationPhase.current + (link.temporalIndex || 0) * 0.1) % 1;
      const particleX = start.x + dx * particlePos;
      const particleY = start.y + dy * particlePos;
      
      ctx.beginPath();
      ctx.arc(particleX, particleY, 2, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(34, 211, 238, ${opacity})`;
      ctx.fill();
    }
    
    // Draw the edge
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = `rgba(34, 211, 238, ${opacity * 0.6})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Draw arrow
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowLength = 6;
    const targetNodeSize = (link.target as GraphNode).val || 5;
    
    const arrowX = end.x - Math.cos(angle) * (targetNodeSize + 3);
    const arrowY = end.y - Math.sin(angle) * (targetNodeSize + 3);
    
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
      arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
      arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = `rgba(34, 211, 238, ${opacity})`;
    ctx.fill();
  }, [currentTime, timeRange, showTemporalFlow]);

  return (
    <div ref={containerRef} className="w-full h-full bg-background rounded-lg overflow-hidden neon-border">
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="transparent"
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeRightClick}
        cooldownTicks={100}
        warmupTicks={50}
        nodeLabel={(node: any) => {
          const n = node as GraphNode;
          let label = `${n.wallet.address}\nSuspicion: ${n.wallet.suspicionScore}`;
          if (n.wallet.temporalAttentionScore) {
            label += `\nTemporal Attention: ${n.wallet.temporalAttentionScore}`;
          }
          return label;
        }}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
