export interface ContentItem {
  type: string;
  text?: string;
  image_url?: string;
}

export interface ChatMessage {
  id: string; // 生成一个UUID，是一个批次，在后台是thread_id
  currentAgent?: string; // 当前最新agent，基于StreamEvent中的agent进行覆盖
  userMessage: UserChatMessage;
  assistantMessage: AssistantChatMessage[];
}

export interface UserChatMessage {
  content: string | object;
}

export interface AssistantChatMessage {
  agent: string;
  messageItem: AssistantChatMessageItem[];
}

export interface AssistantChatMessageItem {
  id: string;
  content: string | object;
}

export interface SelectedNode {
  id: string;
  nodeName: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallChunk {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface StreamEvent {
  event: string;
  data: {
    thread_id: string;
    agent: string;
    id: string;
    role: string;
    content: string;
    finish_reason: string;
    tool_calls?: ToolCall[];
    tool_call_chunks?: ToolCallChunk[];
    tool_call_id?: string;
  };
}

export interface ChatMessageRequest {
  role: 'user' | 'assistant';
  content: string | object;
}

export interface ChatRequest {
  messages: ChatMessageRequest[];
  thread_id?: string;
  number_of_initial_queries?: number;
  max_research_loops?: number;
  search_engines?: string[];
  max_search_results?: number;
}