import { useRef, useEffect, useCallback, type UIEvent } from 'react';
import type { ChatMessage as ChatMessageType } from '../../core/ai';
import { ChatMessage } from './ChatMessage';

interface ChatMessagesProps {
  readonly messages: readonly ChatMessageType[];
  readonly streamingContent: string | null;
  readonly isStreaming: boolean;
  readonly onRetry?: () => void;
}

export function ChatMessages({ messages, streamingContent, isStreaming, onRetry }: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = 40;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, streamingContent, scrollToBottom]);

  // Always scroll to bottom on new user message
  useEffect(() => {
    if (messages.length > 0 && !streamingContent) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user') {
        isAtBottomRef.current = true;
        scrollToBottom();
      }
    }
  }, [messages, streamingContent, scrollToBottom]);

  const lastAssistantError = messages.findLastIndex(
    (m) => m.role === 'system' && m.content.startsWith('[ERROR]'),
  );

  return (
    <div className="chat-messages" ref={containerRef} onScroll={handleScroll}>
      {messages.map((msg, i) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          onRetry={i === lastAssistantError ? onRetry : undefined}
        />
      ))}
      {isStreaming && streamingContent && (
        <ChatMessage
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            timestamp: Date.now(),
          }}
          isStreaming
        />
      )}
    </div>
  );
}
