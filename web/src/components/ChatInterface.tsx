'use client';

import { useState, useRef, useEffect, useMemo, JSX } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, X, ArrowUp, User, Bot } from 'lucide-react';
import { ChatMessage, ChatRequest, StreamEvent, SelectedNode} from '@/types/chat';
import WorkflowGraph from './WorkflowGraph';
import { updateMessageWithStreamEvent } from '@/utils/messageProcessor';
import { useChatContext } from '@/components/contexts/ChatContext';

interface ChatInterfaceProps {
  setSelectedNode?: (message: SelectedNode) => void;
}

export default function ChatInterface({ setSelectedNode }: ChatInterfaceProps) {

  const { messages, addMessage, updateMessage} = useChatContext();

  const [input, setInput] = useState('');
  const [currentThreadId, setCurrentThreadId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const workflowGraphCache = useMemo(() => {
    const cache = new Map<string, JSX.Element>();
    
    messages.forEach((message) => {
      if (!cache.has(message.id)) {
        cache.set(message.id, (
          <WorkflowGraph 
            currentAgent={message.currentAgent} 
            onNodeClick={(nodeName) => handleNodeClick(message.id, nodeName)}
          />
        ));
      }
    });
    
    return cache;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

    // 新增：处理节点点击事件
  const handleNodeClick = (id: string, nodeName:string) => {
    if (setSelectedNode) {
      setSelectedNode({
        id,
        nodeName
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 检查用户是否接近底部
  const checkIfNearBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const threshold = 100; // 距离底部100px内认为是接近底部
      return scrollHeight - scrollTop - clientHeight < threshold;
    }
    return true;
  };

  // 处理滚动事件
  const handleScroll = () => {
    setShouldAutoScroll(checkIfNearBottom());
  };

  useEffect(() => {
    // 只有在用户接近底部时才自动滚动
    if (shouldAutoScroll && checkIfNearBottom()) {
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [messages]);

  useEffect(() => {
    // 只有在应该自动滚动时才滚动到底部
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [shouldAutoScroll]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // 处理流式响
  const handleStreamEvent = (event: StreamEvent, threadId: string) => {
    updateMessage(threadId, (prevMessage: ChatMessage): ChatMessage => {
      // 使用函数式更新确保基于最新状态
      const lastMessage = updateMessageWithStreamEvent(prevMessage, event);
      if (lastMessage && (event.data.agent === 'finalize_answer' 
          && event.data.finish_reason === 'stop')) {
        lastMessage.currentAgent = ''
      }
      return lastMessage;
    });
  };
    
  // 发送消息的函数
  const sendMessage = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;

    const threadId = crypto.randomUUID();
    setCurrentThreadId(threadId)
    const controller = new AbortController();
    setAbortController(controller);
    
    const newMessage: ChatMessage = {
      id: threadId,
      currentAgent: '__start__',
      userMessage: {
        content: input
      },
      assistantMessage: []
    };

    addMessage(newMessage);
    setInput('');
    setSelectedFiles([]);
    setIsLoading(true);

    try {
      // 构建请求数据
      const chatRequest: ChatRequest = {
        messages: [{
          role: 'user',
          content: input,
        }],
        thread_id: threadId,
        max_research_loops: 5,
        search_engines: ['tavily'],
      };

      const response = await fetch('http://localhost:8001/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatRequest),
        signal: controller.signal,
      });
      
      if (!response.body) {
        throw new Error('No response body');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          // 如果是空行，直接跳过
          if (line.trim() === '') {
            continue;
          }

          if (line.startsWith('event: ')) {
            continue;
          }

          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              
              // 只处理 message_chunk 事件
              const streamEvent: StreamEvent = {
                event: "message_chunk",
                data: eventData
              };
              handleStreamEvent(streamEvent, threadId);

              if (eventData.agent === 'finalize_answer' 
                && eventData.finish_reason === 'stop') {
                return;
              }
            } catch (e) {
              console.error('Error parsing stream data:', e);
            }
          }
        }
      }      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user');
      } else {
        console.error('Error sending message:', error);
      }
    } finally {
      setIsLoading(false);
      setAbortController(null); // 确保清理 abortController
    }
  };

  // 添加停止函数
  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
      updateMessage(currentThreadId, (prev) => ({
        ...prev,
        currentAgent: ''
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen pt-1">
      {/* Messages Area - 自动占据剩余空间 */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto minimal-scrollbar"
        onScroll={handleScroll}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">开始对话</h3>
            <p className="text-gray-500 max-w-md">
              我是您的AI助手，可以帮助您解答问题、分析数据、处理文档等。请输入您的问题开始对话。
            </p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className="space-y-4 p-4">
            {/* 用户消息 */}
            <div className="flex items-start justify-end space-x-3">
              <div className="flex-1 max-w-[90%] flex justify-end">
                <div className="rounded-2xl px-4 py-3 bg-blue-400 text-white shadow-sm">
                  <div className="prose prose-sm max-w-none break-words">
                    {typeof message.userMessage.content === 'string' 
                      ? message.userMessage.content 
                      : JSON.stringify(message.userMessage.content)}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-400 text-white">
                <User className="w-4 h-4" />
              </div>
            </div>
            
            {/* 助手消息 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1 max-w-[90%]">
                <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200 text-gray-900 shadow-sm">
                  {/* 显示agent信息 */}
                  <div className="text-xs text-gray-500 mb-2">Agent: {message.currentAgent}</div>
                  
                  {/* 检查是否需要显示工作流图 */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2 text-gray-600">工作流执行图</h4>
                    {workflowGraphCache.get(message.id)}
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start ml-11">
            <div className="border border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - 固定在底部 */}
      <div className="flex-shrink-0 p-6 bg-[#fffaf5] border-gray-200">
        {/* ... 保持现有的输入区域代码不变 ... */}
        {/* File Preview */}
        {selectedFiles.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center bg-gray-100 rounded-lg px-3 py-2 text-sm"
              >
                <Paperclip className="w-4 h-4 mr-2 text-gray-500" />
                <span className="truncate max-w-[200px] text-gray-700">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-auto p-1 hover:bg-gray-200"
                  onClick={() => removeFile(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Input Container */}
        <div className="chat-input-container relative bg-gray-50 rounded-2xl border hover:border-gray-300 transition-all duration-200">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的消息..."
            className="min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent pr-16 pl-6 py-6 pb-12"
            disabled={isLoading}
          />
          
          {/* Bottom Tools Row */}
          <div className="absolute bottom-3 left-4 right-16 flex items-center space-x-2">
            {/* Tool Buttons */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-6 w-6 rounded hover:bg-gray-200 text-gray-500 focus:ring-0 focus:outline-none"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              disabled={isLoading}
              className="h-6 w-6 rounded hover:bg-gray-200 text-gray-500 focus:ring-0 focus:outline-none"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              disabled={isLoading}
              className="h-6 w-6 rounded hover:bg-gray-200 text-gray-500 focus:ring-0 focus:outline-none"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              disabled={isLoading}
              className="h-6 w-6 rounded hover:bg-gray-200 text-gray-500 focus:ring-0 focus:outline-none"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </Button>
          </div>
          
          {/* Send Button */}
          <Button
            onClick={isLoading ? stopGeneration : sendMessage}
            disabled={!isLoading && (!input.trim() && selectedFiles.length === 0)}
            className={`absolute bottom-3 right-3 h-8 w-8 rounded-full focus:ring-0 focus:outline-none ${
              isLoading 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-black hover:bg-gray-800 disabled:bg-gray-300'
            }`}
            size="icon"
          >
            {isLoading ? (
              <div className="w-4 h-4 flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ArrowUp className="w-4 h-4 text-white" />
            )}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}