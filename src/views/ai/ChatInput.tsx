import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';

interface ChatInputProps {
  readonly onSend: (content: string) => void;
  readonly onStop: () => void;
  readonly isStreaming: boolean;
  readonly disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-container">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          disabled={disabled}
        />
        {isStreaming ? (
          <button className="chat-send-btn stop" onClick={onStop} title="Stop generating">
            <Square size={16} />
          </button>
        ) : (
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            title="Send message (Enter)"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

// Public focus method
export function focusChatInput(): void {
  const el = document.querySelector('.chat-textarea') as HTMLTextAreaElement | null;
  el?.focus();
}
