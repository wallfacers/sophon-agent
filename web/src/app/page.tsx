'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import ChatInterface from '@/components/ChatInterface';
import DetailPanel from '@/components/DetailPanel';
import { SelectedNode } from '@/types/chat';

export default function Home() {
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  
  // 使用useMemo优化双栏模式的判断
  const doubleColumnMode = useMemo(
    () => selectedNode !== null,
    [selectedNode],
  );

  // 当前要显示的消息（优先显示节点消息）


  return (
    <div className="h-screen relative">
      {/* Main Content Area */}
      <div className="flex h-full w-full justify-center gap-8">
        {/* Left Panel - Chat Interface */}
        <div className={cn(
            "transition-all duration-300 ease-out rounded-lg",
            !doubleColumnMode && "w-full max-w-4xl mx-auto",
            doubleColumnMode && "w-[40%] -ml-160"
          )}>
          <div className="h-full">
            <div className="h-[calc(100vh-2rem)]">
              <ChatInterface 
                setSelectedNode={setSelectedNode}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Detail View */}
        <div className={cn(
          "rounded-md transition-all duration-300 ease-out fixed top-4 right-4 z-50 bg-white",
          !doubleColumnMode && "scale-0 w-0 opacity-0",
          doubleColumnMode && "w-[40%] opacity-100 h-[calc(100vh-2rem)]"  // 悬浮固定窗体
        )}>
          <DetailPanel 
            selectedNode={selectedNode} 
            onClose={() => {
              setSelectedNode(null);
            }} 
          />
        </div>
      </div>
    </div>
  );
}