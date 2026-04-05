import { useState, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, AlertCircle } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../core/ai';

interface ChatMessageProps {
  readonly message: ChatMessageType;
  readonly isStreaming?: boolean;
  readonly onRetry?: () => void;
}

function CodeBlock({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace('language-', '') ?? '';

  const handleCopy = useCallback(() => {
    const text = String(children).replace(/\n$/, '');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{lang}</span>
        <button className={`code-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre><code className={className}>{children}</code></pre>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessage({ message, isStreaming, onRetry }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.role === 'system' && message.content.startsWith('[ERROR]');

  if (isError) {
    const errorText = message.content.replace('[ERROR] ', '');
    return (
      <div className="chat-message error">
        <div className="message-bubble">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span className="message-error-content">{errorText}</span>
          {onRetry && (
            <button className="message-retry-btn" onClick={onRetry}>Retry</button>
          )}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="chat-message user">
        <div className="message-bubble">{message.content}</div>
        <span className="message-time">{formatTime(message.timestamp)}</span>
      </div>
    );
  }

  return (
    <div className="chat-message assistant">
      <div className={`message-bubble ${isStreaming ? 'streaming-cursor' : ''}`}>
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ pre: ({ children }) => <>{children}</>, code: ({ className, children, ...props }) => {
              const isInline = !className && typeof children === 'string' && !children.includes('\n');
              if (isInline) return <code className={className} {...props}>{children}</code>;
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }}}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
      {!isStreaming && (
        <span className="message-time">{formatTime(message.timestamp)}</span>
      )}
    </div>
  );
}
