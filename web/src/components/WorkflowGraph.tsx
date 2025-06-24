import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css'

interface GraphData {
  entry_point: string | null;
  end_points: string[];
  nodes: Array<{
    name: string;
    type: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    condition: string;
  }>;
}

interface WorkflowGraphProps {
  currentAgent?: string;
  onNodeClick?: (nodeName: string) => void;
}

// 固定节点位置配置
const getNodePosition = (nodeName: string) => {
  const positions: { [key: string]: { x: number; y: number } } = {
    '__start__': { x: 109, y: 50 },
    'generate_query': { x: 100, y: 150 },
    'web_research': { x: 107, y: 250 },
    'reflection': { x: 350, y: 250 },
    'finalize_answer': { x: 344, y: 350 },
    '__end__': { x: 350, y: 450 }
  };
  return positions[nodeName] || { x: 0, y: 0 };
};

export default function WorkflowGraph({currentAgent, onNodeClick }: WorkflowGraphProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const CustomNode = ({ data }: { data: { 
    label: string;
    nodeName: string;
    isCurrentlyExecuting: boolean;
    isSelected: boolean;
  } }) => {
    const { label, nodeName, isCurrentlyExecuting, isSelected } = data;
    
    const handleClick = () => {
      setSelectedNode(nodeName);
      onNodeClick?.(nodeName);
    };
    
    return (
      <>
        <div 
          className={`px-4 py-2 shadow-md rounded-lg min-w-[120px] text-center relative cursor-pointer hover:shadow-lg transition-all duration-300 ${
            isSelected 
                ? 'bg-green-100' 
                : 'bg-white hover:border-gray-400'
          }`}
          onClick={handleClick}
        >
          <div className="font-medium text-sm flex items-center justify-center gap-2">
            <span className={isSelected ? 'text-blue-700' : ''}>{label}</span>
            {isCurrentlyExecuting && (
              <svg 
                className="w-4 h-4 text-green-500 animate-spin" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                ></circle>
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
          </div>
        </div>
        {/* 添加默认的handles */}
        <Handle type="source" position={Position.Bottom} />
        <Handle type="target" position={Position.Top} />
      </>
    );
  };

  // 使用useMemo记忆化nodeTypes对象，避免每次重新渲染时重新创建
  const nodeTypes: NodeTypes = useMemo(() => ({
    custom: CustomNode,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // 获取图数据
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch('http://localhost:8001/api/graph');
        if (!response.ok) {
          throw new Error('Failed to fetch graph data');
        }
        const data = await response.json();
        setGraphData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, []);
 
  // 生成节点和边
  useEffect(() => {
    if (!graphData) return;
    
    // 创建节点
    const flowNodes: Node[] = graphData.nodes.map((node) => {
      const isCurrentlyExecuting = currentAgent === node.name;
      const isSelected = selectedNode === node.name;
      const position = getNodePosition(node.name);

      return {
        id: node.name,
        type: 'custom',
        position: position,
        data: {
          label: node.name,
          nodeName: node.name,
          isCurrentlyExecuting,
          isSelected
        },
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
      };
    });

    // 创建有效节点ID集合
    const nodeIds = new Set(flowNodes.map(node => node.id));
    
    // 创建边，直接使用API返回的边对象
    const flowEdges: Edge[] = [];
    
    graphData.edges.forEach((edge, index) => {
      
      // 验证边数据的有效性
      if (!edge.source || !edge.target) {
        return;
      }

      // 验证source和target节点是否存在
      if (!nodeIds.has(edge.source)) {
        return;
      }
      
      if (!nodeIds.has(edge.target)) {
        return;
      }

      // 确保source和target不相同（避免自循环）
      if (edge.source === edge.target) {
        return;
      }

      // 根据边的类型设置不同的样式
      const isConditionalEdge = edge.type === 'conditional_edge';
      const isCurrentlyActive = currentAgent === edge.source;
      const isSelectedEdge = selectedNode === edge.source || selectedNode === edge.target;

      const flowEdge: Edge = {
        id: `edge-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: isCurrentlyActive,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 10,
          height: 10,
          color: isCurrentlyActive 
            ? '#10b981' 
            : isSelectedEdge 
              ? '#3b82f6' 
              : (isConditionalEdge ? '#f59e0b' : '#6b7280'),
        },
        style: {
          stroke: isCurrentlyActive 
            ? '#10b981' 
            : isSelectedEdge 
              ? '#3b82f6' 
              : (isConditionalEdge ? '#f59e0b' : '#6b7280'),
          strokeWidth: isSelectedEdge ? 2 : 1.5,
          strokeDasharray: isConditionalEdge ? '5,5' : undefined // 条件边使用虚线
        }
      };

      flowEdges.push(flowEdge);
    });
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, currentAgent, selectedNode, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // 点击空白区域取消选中
  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center border rounded-lg">
        <div className="text-gray-500">加载工作流图...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-64 flex items-center justify-center border rounded-lg">
        <div className="text-red-500">加载失败: {error}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-128 border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        attributionPosition="bottom-left"
        fitView
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        selectNodesOnDrag={false}
        onPaneClick={handlePaneClick}
        className="bg-teal-50"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}