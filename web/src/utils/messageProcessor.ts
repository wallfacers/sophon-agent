import { ChatMessage, StreamEvent } from '@/types/chat';

/**
 * 处理单个流式事件并更新现有消息
 * @param existingMessage 现有消息
 * @param streamEvent 新的流式事件
 * @returns 更新后的消息
 */
export function updateMessageWithStreamEvent(
  existingMessage: ChatMessage, 
  streamEvent: StreamEvent
): ChatMessage {
  const { agent, id, content } = streamEvent.data;
  
  // 创建消息的深拷贝，避免直接修改原对象
  const updatedMessage = JSON.parse(JSON.stringify(existingMessage));
  
  // 查找或创建对应agent的消息
  let agentMessage = updatedMessage.assistantMessage.find((msg: { agent: string; }) => msg.agent === agent);
  
  if (!agentMessage) {
    agentMessage = {
      agent: agent,
      messageItem: []
    };
    updatedMessage.assistantMessage.push(agentMessage);
  }
  
  // 查找或创建对应id的子消息
  let subMessage = agentMessage.messageItem.find((msg: { id: string; }) => msg.id === id);
  
  if (content) {
    if (!subMessage) {
      subMessage = {
        id: id,
        content: content,
      };
      agentMessage.messageItem.push(subMessage);
    } else {
      // 安全的内容拼接，避免并发问题
      if (typeof subMessage.content === 'string' && typeof content === 'string') {
        // 使用原子操作确保内容正确拼接
        subMessage.content = subMessage.content + content;
      } else {
        subMessage.content = content;
      }
    }
  }
  
  updatedMessage.currentAgent = agent;
  
  return updatedMessage;
}