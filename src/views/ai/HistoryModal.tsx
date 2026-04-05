import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Trash2, MessageSquare } from 'lucide-react';
import type { ChatSession } from '../../core/ai';
import { sessionStore } from '../../core/ai';
import type { ConfirmOptions } from '../../components/ConfirmDialog';

interface HistoryModalProps {
  readonly onSelectSession: (session: ChatSession) => void;
  readonly onClose: () => void;
  readonly onSessionsChanged: () => void;
  readonly confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const HISTORY_HINTS = (
  <div className="ai-footer-commands" style={{ padding: '8px 20px 10px', borderTop: '1px solid var(--border)' }}>
    <span><kbd>↑↓</kbd> Navigate</span>
    <span><kbd>Enter</kbd> Open</span>
    <span><kbd>Del</kbd> Delete</span>
    <span><kbd>Esc</kbd> Close</span>
  </div>
);

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function HistoryModal({ onSelectSession, onClose, onSessionsChanged, confirm }: HistoryModalProps) {
  const [sessions, setSessions] = useState<readonly ChatSession[]>(() => sessionStore.getAll());
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredSessions = search
    ? sessions.filter((s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase())),
      )
    : sessions;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector('.history-item.selected') as HTMLElement | null;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const deleteSession = useCallback(async (sessionId: string) => {
    const ok = await confirm({
      title: 'Delete Chat',
      message: 'Delete this conversation? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) {
      sessionStore.delete(sessionId);
      setSessions(sessionStore.getAll());
      onSessionsChanged();
    }
  }, [confirm, onSessionsChanged]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in search (except arrow down to enter list)
      if (document.activeElement === inputRef.current && e.key !== 'ArrowDown' && e.key !== 'Escape') {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (document.activeElement === inputRef.current) {
            inputRef.current?.blur();
          }
          setSelectedIndex((prev) => Math.min(prev + 1, filteredSessions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredSessions[selectedIndex]) {
            onSelectSession(filteredSessions[selectedIndex]);
          }
          break;
        case 'Delete':
          if (filteredSessions[selectedIndex]) {
            deleteSession(filteredSessions[selectedIndex].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSessions, selectedIndex, onSelectSession, deleteSession]);

  const handleDelete = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  }, [deleteSession]);

  const handleClearAll = useCallback(async () => {
    const ok = await confirm({
      title: 'Clear All History',
      message: 'Delete all chat history? This cannot be undone.',
      confirmLabel: 'Clear All',
      destructive: true,
    });
    if (ok) {
      sessionStore.clearAll();
      setSessions([]);
      onSessionsChanged();
    }
  }, [confirm, onSessionsChanged]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-card">
        <div className="modal-header">
          <span className="modal-title">Chat History</span>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-search">
          <input
            ref={inputRef}
            className="modal-search-input"
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="modal-list" ref={listRef}>
          {filteredSessions.length === 0 ? (
            <div className="modal-empty">
              <MessageSquare size={32} style={{ opacity: 0.3 }} />
              <span>{search ? 'No matching conversations' : 'No conversations yet'}</span>
            </div>
          ) : (
            filteredSessions.map((session, i) => {
              const lastMsg = session.messages[session.messages.length - 1];
              const preview = lastMsg
                ? lastMsg.content.slice(0, 60).replace(/\n/g, ' ')
                : 'Empty conversation';

              return (
                <div
                  key={session.id}
                  className={`history-item${i === selectedIndex ? ' selected' : ''}`}
                  onClick={() => onSelectSession(session)}
                >
                  <div className="history-item-content">
                    <div className="history-item-title">{session.title}</div>
                    <div className="history-item-preview">{preview}</div>
                  </div>
                  <div className="history-item-meta">
                    <span className="history-item-time">{formatRelativeTime(session.updatedAt)}</span>
                    <span className="history-item-model">{session.modelId}</span>
                  </div>
                  <button
                    className="history-item-delete"
                    onClick={(e) => handleDelete(e, session.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        {HISTORY_HINTS}
        {sessions.length > 0 && (
          <div className="modal-footer">
            <button className="modal-footer-btn" onClick={handleClearAll}>
              Clear all history
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
