import { useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { ArrowLeft, SquarePlus, Clock, Settings2 } from 'lucide-react';

interface ChatToolbarProps {
  readonly title: string;
  readonly onBack: () => void;
  readonly onNewChat: () => void;
  readonly onOpenHistory: () => void;
  readonly onOpenProviders: () => void;
  readonly modelDisplay?: string;
}

export function ChatToolbar({
  title,
  onBack,
  onNewChat,
  onOpenHistory,
  onOpenProviders,
  modelDisplay,
}: ChatToolbarProps) {
  const titleRef = useRef<HTMLSpanElement>(null);

  const handleTitleDoubleClick = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.contentEditable = 'true';
    el.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const handleTitleBlur = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.contentEditable = 'false';
  }, []);

  const handleTitleKeyDown = useCallback((e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }, []);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (el.contentEditable === 'true' && e.key === 'Escape') {
        el.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="chat-toolbar">
      <div className="chat-toolbar-left">
        <button className="toolbar-btn back-btn" onClick={onBack} title="Back to search">
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="chat-toolbar-center">
        <span
          ref={titleRef}
          className="chat-toolbar-title"
          onDoubleClick={handleTitleDoubleClick}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          title="Double-click to rename"
        >
          {title}
        </span>
        {modelDisplay && (
          <div className="active-model-badge">
            <span className="active-model-badge-dot" />
            {modelDisplay}
          </div>
        )}
      </div>
      <div className="chat-toolbar-right">
        <button className="toolbar-btn" onClick={onNewChat} title="New chat (Ctrl+N)">
          <SquarePlus size={18} />
        </button>
        <button className="toolbar-btn" onClick={onOpenHistory} title="History (Ctrl+H)">
          <Clock size={18} />
        </button>
        <button className="toolbar-btn" onClick={onOpenProviders} title="Providers (Ctrl+P)">
          <Settings2 size={18} />
        </button>
      </div>
    </div>
  );
}
