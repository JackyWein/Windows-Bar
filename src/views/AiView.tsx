import { useState, useEffect, useCallback, useRef } from 'react';
import type { AISettings, ChatSession, ChatMessage } from '../core/ai';
import { ChatEngine } from '../core/ai/chat';
import { sessionStore } from '../core/ai/sessions';
import { ChatToolbar } from './ai/ChatToolbar';
import { ChatMessages } from './ai/ChatMessages';
import { ChatInput, focusChatInput } from './ai/ChatInput';
import { HistoryModal } from './ai/HistoryModal';
import { ProviderModal } from './ai/ProviderModal';
import { OnboardingCard } from './ai/OnboardingCard';
import { useConfirm } from '../components/ConfirmDialog';
import '../styles/ai.css';

interface AiViewProps {
  readonly settings: AISettings;
  readonly onSettingsChange: (settings: AISettings) => void;
  readonly onBack: () => void;
}

export function AiView({ settings, onSettingsChange, onBack }: AiViewProps) {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [sessionTitle, setSessionTitle] = useState('New Chat');
  const [chatState, setChatState] = useState<'idle' | 'streaming' | 'error'>('idle');
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showProviders, setShowProviders] = useState(false);

  const engineRef = useRef(new ChatEngine());
  const sessionIdRef = useRef<string | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const [confirmDialog, confirm] = useConfirm();

  const engine = engineRef.current;
  const isStreaming = chatState === 'streaming';
  const isConfigured = settings.setupComplete && settings.defaultProvider && settings.defaultModel;

  // Get display name for active model
  const modelDisplay = settings.defaultModel
    ? getModelDisplayName(settings.defaultModel)
    : undefined;

  // Set active provider/model on engine when settings change
  useEffect(() => {
    if (settings.defaultProvider && settings.defaultModel) {
      engine.setActive(settings.defaultProvider, settings.defaultModel);
    }
  }, [settings.defaultProvider, settings.defaultModel, engine]);

  // Setup IPC listeners for streaming
  useEffect(() => {
    const handleChunk = (chunk: string) => {
      setStreamingContent((prev) => (prev ?? '') + chunk);
    };

    const handleComplete = () => {
      const content = streamingContentRef.current ?? '';
      if (content) {
        const assistantMsg = engine.addAssistantMessage(content);

        // Save to session store
        if (sessionIdRef.current) {
          sessionStore.addMessage(sessionIdRef.current, assistantMsg);
          sessionStore.updateMessages(sessionIdRef.current, engine.toSessionMessages());
        }

        setMessages(engine.getMessages());
      }
      streamingContentRef.current = null;
      setStreamingContent(null);
      setChatState('idle');
    };

    const handleError = (error: string) => {
      const errorMsg = engine.addSystemMessage(`[ERROR] ${error}`);
      if (sessionIdRef.current) {
        sessionStore.addMessage(sessionIdRef.current, errorMsg);
      }
      setMessages(engine.getMessages());
      streamingContentRef.current = null;
      setStreamingContent(null);
      setChatState('error');
    };

    window.electronAPI.onAiChunk(handleChunk);
    window.electronAPI.onAiComplete(handleComplete);
    window.electronAPI.onAiError(handleError);

    return () => {
      window.electronAPI.removeAiListeners();
    };
  }, [engine]);

  // Ref to track latest streaming content for the complete handler
  const streamingContentRef = useRef<string | null>(null);
  useEffect(() => {
    streamingContentRef.current = streamingContent;
  }, [streamingContent]);

  // Keybinds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).contentEditable === 'true';

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault();
            setShowHistory((prev) => !prev);
            break;
          case 'p':
            e.preventDefault();
            setShowProviders((prev) => !prev);
            break;
          case 'l':
            e.preventDefault();
            if (!isInput) focusChatInput();
            break;
          case 'n':
            e.preventDefault();
            handleNewChat();
            break;
        }
      }

      if (e.key === 'Escape') {
        if (showHistory) setShowHistory(false);
        else if (showProviders) setShowProviders(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistory, showProviders]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!isConfigured || isStreaming) return;

      const userMsg = engine.addUserMessage(content);
      lastUserMessageRef.current = content;

      // Create session if needed
      if (!sessionIdRef.current) {
        const session = sessionStore.create(
          settings.defaultProvider!,
          settings.defaultModel!,
          content,
        );
        sessionIdRef.current = session.id;
        setSessionTitle(session.title);
      }

      sessionStore.addMessage(sessionIdRef.current, userMsg);
      setMessages(engine.getMessages());

      // Build request
      const request = engine.buildRequest(settings.providers);
      if (!request) {
        const errorMsg = engine.addSystemMessage('[ERROR] Failed to build request. Check provider configuration.');
        if (sessionIdRef.current) sessionStore.addMessage(sessionIdRef.current, errorMsg);
        setMessages(engine.getMessages());
        setChatState('error');
        return;
      }

      // Start streaming
      setChatState('streaming');
      setStreamingContent('');

      try {
        await window.electronAPI.aiChat(request as Parameters<typeof window.electronAPI.aiChat>[0]);
      } catch (err) {
        // Error will be handled by the IPC error listener
        setChatState('error');
      }
    },
    [isConfigured, isStreaming, settings, engine],
  );

  const handleStop = useCallback(() => {
    window.electronAPI.aiAbort();
    // If we had partial content, save it
    const content = streamingContentRef.current;
    if (content) {
      const partialMsg = engine.addAssistantMessage(content + ' (stopped)');
      if (sessionIdRef.current) {
        sessionStore.addMessage(sessionIdRef.current, partialMsg);
      }
      setMessages(engine.getMessages());
    }
    streamingContentRef.current = null;
    setStreamingContent(null);
    setChatState('idle');
  }, [engine]);

  const handleRetry = useCallback(() => {
    if (!lastUserMessageRef.current || isStreaming) return;
    // Remove the last error message and the last user message
    const currentMessages = engine.getMessages();
    const withoutLast = currentMessages.slice(0, -1); // Remove error
    const withoutUserAndError = withoutLast.slice(0, -1); // Remove user message
    engine.loadMessages(withoutUserAndError);
    setMessages(engine.getMessages());

    // Re-send
    const content = lastUserMessageRef.current;
    lastUserMessageRef.current = null;
    // Small delay to let state settle
    setTimeout(() => handleSend(content), 50);
  }, [engine, isStreaming, handleSend]);

  const handleNewChat = useCallback(() => {
    engine.clear();
    sessionIdRef.current = null;
    lastUserMessageRef.current = null;
    setMessages([]);
    setSessionTitle('New Chat');
    setChatState('idle');
    setStreamingContent(null);
    focusChatInput();
  }, [engine]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      engine.loadMessages(session.messages);
      engine.setActive(session.providerId, session.modelId);
      sessionIdRef.current = session.id;
      setMessages(session.messages);
      setSessionTitle(session.title);
      setShowHistory(false);

      // Update settings to match session's provider/model
      if (
        session.providerId !== settings.defaultProvider ||
        session.modelId !== settings.defaultModel
      ) {
        onSettingsChange({
          ...settings,
          defaultProvider: session.providerId,
          defaultModel: session.modelId,
        });
      }
    },
    [engine, settings, onSettingsChange],
  );

  const handleSessionsChanged = useCallback(() => {
    // Refresh if current session was deleted
    if (sessionIdRef.current && !sessionStore.getById(sessionIdRef.current)) {
      handleNewChat();
    }
  }, [handleNewChat]);

  // Render onboarding if not configured
  if (!isConfigured) {
    return (
      <div className="app-container">
        <div className="search-glass ai-view">
        <ChatToolbar
          title="AI Chat"
          onBack={onBack}
          onNewChat={handleNewChat}
          onOpenHistory={() => setShowHistory(true)}
          onOpenProviders={() => setShowProviders(true)}
        />
        <OnboardingCard onOpenProviders={() => setShowProviders(true)} />
        {showProviders && (
          <ProviderModal
            settings={settings}
            onSettingsChange={onSettingsChange}
            onClose={() => setShowProviders(false)}
            confirm={confirm}
          />
        )}
        {confirmDialog}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="search-glass ai-view">
      <ChatToolbar
        title={sessionTitle}
        onBack={onBack}
        onNewChat={handleNewChat}
        onOpenHistory={() => setShowHistory(true)}
        onOpenProviders={() => setShowProviders(true)}
        modelDisplay={modelDisplay}
      />
      <ChatMessages
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        onRetry={handleRetry}
      />
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={!isConfigured}
      />
      <div className="ai-footer">
        <div className="ai-footer-commands">
          <span><kbd>Ctrl+N</kbd> New Chat</span>
          <span><kbd>Ctrl+H</kbd> History</span>
          <span><kbd>Ctrl+P</kbd> Providers</span>
          <span><kbd>Ctrl+L</kbd> Focus Input</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
      {showHistory && (
        <HistoryModal
          onSelectSession={handleSelectSession}
          onClose={() => setShowHistory(false)}
          onSessionsChanged={handleSessionsChanged}
          confirm={confirm}
        />
      )}
      {showProviders && (
        <ProviderModal
          settings={settings}
          onSettingsChange={onSettingsChange}
          onClose={() => setShowProviders(false)}
          confirm={confirm}
        />
      )}
      {confirmDialog}
      </div>
    </div>
  );
}

function getModelDisplayName(modelId: string): string {
  const nameMap: Record<string, string> = {
    'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-opus-4-6': 'Claude Opus 4.6',
    'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'o3-mini': 'o3-mini',
    'gemini-2.0-pro': 'Gemini 2.0 Pro',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'llama3': 'Llama 3',
    'mistral': 'Mistral',
    'codellama': 'Code Llama',
  };
  return nameMap[modelId] ?? modelId;
}
