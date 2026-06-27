// ========================
// Chat Engine
// ========================

import type { ChatMessage, AIRequest } from './types';
import { generateId } from './types';
import type { ProviderConfig } from './types';
import { providerRegistry } from './providers';

type ChatState = 'idle' | 'streaming' | 'error';

/**
 * Manages a single chat conversation.
 * Handles building requests, tracking state, and managing messages.
 */
export class ChatEngine {
  private messages: ChatMessage[] = [];
  private state: ChatState = 'idle';
  private activeProviderId: string | null = null;
  private activeModelId: string | null = null;
  private abortController: AbortController | null = null;

  getState(): ChatState {
    return this.state;
  }

  getMessages(): readonly ChatMessage[] {
    return this.messages;
  }

  getActiveProvider(): string | null {
    return this.activeProviderId;
  }

  getActiveModel(): string | null {
    return this.activeModelId;
  }

  /** Set the active provider and model for this conversation */
  setActive(providerId: string, modelId: string): void {
    this.activeProviderId = providerId;
    this.activeModelId = modelId;
  }

  /** Load messages from a previous session */
  loadMessages(messages: readonly ChatMessage[]): void {
    this.messages = [...messages];
  }

  /** Add a user message to the conversation */
  addUserMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.messages = [...this.messages, message];
    return message;
  }

  /** Add an assistant message to the conversation */
  addAssistantMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
    };
    this.messages = [...this.messages, message];
    return message;
  }

  /** Add a system message to the conversation */
  addSystemMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      role: 'system',
      content,
      timestamp: Date.now(),
    };
    this.messages = [...this.messages, message];
    return message;
  }

  /**
   * Build the AIRequest for the current conversation state.
   * Returns null if no provider/model is set or no user messages exist.
   */
  buildRequest(configs: Readonly<Record<string, ProviderConfig>>): AIRequest | null {
    if (!this.activeProviderId || !this.activeModelId) return null;

    const provider = providerRegistry.getById(this.activeProviderId);
    if (!provider) return null;

    const config = configs[this.activeProviderId];
    if (!config || !provider.validateConfig(config)) return null;

    return provider.buildRequest(this.messages, this.activeModelId, config);
  }

  /** Abort the current streaming request */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.state = 'idle';
  }

  /** Clear all messages */
  clear(): void {
    this.messages = [];
    this.state = 'idle';
  }

  /** Get messages serializable for session storage */
  toSessionMessages(): readonly ChatMessage[] {
    return this.messages;
  }
}
