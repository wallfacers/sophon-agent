'use client';

import { X, User, Bot} from 'lucide-react';
import { useEffect, useRef} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card';
import { SelectedNode } from '@/types/chat';
import { Markdown } from '@/components/markdown';
import { useChatContext } from '@/components/contexts/ChatContext';


interface DetailPanelProps {
  selectedNode: SelectedNode | null;
  onClose: () => void;
}

export default function DetailPanel({ selectedNode, onClose}: DetailPanelProps) {
  const { getMessageById} = useChatContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 将 useEffect 移到这里，在所有条件检查之前
  const message = selectedNode ? getMessageById(selectedNode.id) : null;
  
  // 自动滚动到底部的函数
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    // 你的 effect 逻辑
    scrollToBottom();
  }, [selectedNode?.nodeName, message?.assistantMessage]);

  // 条件检查放在 Hooks 之后
  if (!selectedNode) {
    return null;
  }

  if (!message) {
    return null;
  }

  const currentAgent = selectedNode.nodeName;

  return (
    <Card className="w-full h-full border-gray-200 flex flex-col rounded-md">
      <CardHeader className="px-6 border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                节点详情
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                消息节点详情和元数据
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="hover:bg-gray-200"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto minimal-scrollbar pb-6 px-6 space-y-6"
      >

        {/* User Message */}
        {message.userMessage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>用户消息</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-l-2 border-blue-200 pl-4">
                <div className="max-w-none prose-blue">
                  {typeof message.userMessage.content === 'string' ? (
                    <Markdown className="mb-3 last:mb-0 leading-relaxed">
                      {message.userMessage.content}
                    </Markdown>
                  ) : (
                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-sm font-mono">
                      {JSON.stringify(message.userMessage.content, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assistant Messages */}
        {currentAgent && message.assistantMessage && message.assistantMessage.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <Bot className="w-4 h-4" />
                <span>Agent: {currentAgent}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {message.assistantMessage.filter(msg => msg.agent === currentAgent).map((assistantMsg, assistantIndex) => (
                  <div key={assistantIndex} className="border-gray-200 rounded-lg pd-4 px-4">
                    <div className="space-y-3">
                      {assistantMsg.messageItem.map((messageItem, itemIndex) => (
                        <div key={messageItem.id} className="border-l-2 border-gray-200 pl-4">
                          <div className="text-xs text-gray-500 mb-2">
                            项目 {itemIndex + 1} (ID: {messageItem.id})
                          </div>
                          <div className="max-w-none prose-gray">
                            {typeof messageItem.content === 'string' ? (
                              <Markdown className="mb-3 last:mb-0 leading-relaxed">
                                {messageItem.content}
                              </Markdown>
                            ) : (
                              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-sm font-mono">
                                {JSON.stringify(messageItem.content, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
      
    </Card>
  );
}
