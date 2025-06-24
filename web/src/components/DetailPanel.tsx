'use client';

import { X, User, Bot} from 'lucide-react';
import { useEffect, useRef, useCallback, useState, useMemo} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card';
import { SelectedNode } from '@/types/chat';
import { Markdown } from '@/components/markdown';
import { useChatContext } from '@/components/contexts/ChatContext';


interface DetailPanelProps {
  selectedNode: SelectedNode | null;
  onClose: () => void;
}

// 在文件顶部添加安全的JSON渲染函数
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SafeJsonRenderer = ({ content }: { content: any }) => {
  const renderJsonContent = () => {
    try {
      // 如果content已经是字符串，尝试解析它
      if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        } catch {
          // 如果解析失败，直接返回原字符串
          return content;
        }
      }
      // 如果content不是字符串，直接格式化
      return JSON.stringify(content, null, 2);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return content;
    }
  };

  return (
    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
      {renderJsonContent()}
    </pre>
  );
};

export default function DetailPanel({ selectedNode, onClose}: DetailPanelProps) {
  const { getMessageById} = useChatContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // 将 useEffect 移到这里，在所有条件检查之前
  const message = selectedNode ? getMessageById(selectedNode.id) : null;

  // 检查用户是否接近底部
  const checkIfNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;
    const container = scrollContainerRef.current;
    const threshold = 100; // 距离底部100px内认为是接近底部
    return container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
  }, []);
  
  // 自动滚动到底部的函数
  const handleScroll = useCallback(() => {
    setShouldAutoScroll(checkIfNearBottom());
  }, [checkIfNearBottom]);

  // 自动滚动到底部的函数
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  };

  // 当选中的节点改变时，重置自动滚动状态
  useEffect(() => {
    setShouldAutoScroll(true);
    scrollToBottom();
  }, [selectedNode?.id]);

  // 计算当前agent的消息内容
  const currentAgentMessages = useMemo(() => {
    if (!message?.assistantMessage || !selectedNode?.nodeName) return [];
    return message.assistantMessage
      .filter(msg => msg.agent === selectedNode.nodeName)
      .flatMap(msg => msg.messageItem);
  }, [message?.assistantMessage, selectedNode?.nodeName]);

  useEffect(() => {
    // 只有在用户接近底部时才自动滚动
    if (shouldAutoScroll && checkIfNearBottom()) {
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [currentAgentMessages]); 

  // 只有在应该自动滚动时才滚动到底部
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [shouldAutoScroll]);

  // 添加滚动事件监听器
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

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
                    <Markdown className="mb-3 last:mb-0 leading-relaxed max-w-none">
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
                <span>节点: {currentAgent}</span>
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
                            {typeof messageItem.content === 'string' && (assistantMsg.agent !== 'generate_query' && assistantMsg.agent !== 'reflection') ? (
                              <Markdown className="mb-3 last:mb-0 leading-relaxed max-w-none">
                                {messageItem.content}
                              </Markdown>
                            ) : (
                              <SafeJsonRenderer content={messageItem.content} />
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
