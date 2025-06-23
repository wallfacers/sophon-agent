'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ChatMessage } from '@/types/chat';

interface ChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updater: (prev: ChatMessage) => ChatMessage) => void;
  clearMessages: () => void;
  getMessageById: (id: string) => ChatMessage | undefined;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updater: (prev: ChatMessage) => ChatMessage) => {
    setMessages(prev => {
      const messageIndex = prev.findIndex(msg => msg.id === id);
      if (messageIndex === -1) return prev;
      
      const newMessages = [...prev];
      newMessages[messageIndex] = updater(newMessages[messageIndex]);
      return newMessages;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const getMessageById = useCallback((id: string) => {
    return messages.find(msg => msg.id === id);
  }, [messages]);

  return (
    <ChatContext.Provider value={{
      messages,
      setMessages,
      addMessage,
      updateMessage,
      clearMessages,
      getMessageById
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};