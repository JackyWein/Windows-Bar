// ========================
// AI Types & Interfaces
// ========================

/** A model available from a provider */
export interface AIModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

/** A single message in a chat conversation */
export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: number;
}

/** Provider type classification */
export type ProviderType = 'api' | 'cli';

/** Configuration stored per-provider in settings */
export interface ProviderConfig {
  readonly enabled: boolean;
  readonly apiKey?: string;
  readonly name?: string;
  readonly endpoint?: string;
  readonly models?: readonly AIModel[];
  readonly cliCommand?: string;
}

/** The AI provider interface — all providers must implement this */
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;
  readonly models: readonly AIModel[];
  readonly description: string;

  /** Validate that the given config is sufficient to use this provider */
  validateConfig(config: ProviderConfig): boolean;

  /**
   * Build the request that the main process will execute.
   * Returns a serializable object the main process understands.
   */
  buildRequest(
    messages: readonly ChatMessage[],
    modelId: string,
    config: ProviderConfig,
  ): AIRequest;
}

/** Serialized request sent to main process via IPC */
export interface AIRequest {
  readonly providerId: string;
  readonly providerType: ProviderType;
  readonly modelId: string;
  readonly url?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly cliCommand?: string;
  readonly cliArgs?: readonly string[];
  readonly cliInput?: string;
}

/** A persisted chat session */
export interface ChatSession {
  readonly id: string;
  readonly title: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly messages: readonly ChatMessage[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** AI settings stored in AppSettings.ai */
export interface AISettings {
  readonly defaultProvider: string | null;
  readonly defaultModel: string | null;
  readonly setupComplete: boolean;
  readonly providers: Readonly<Record<string, ProviderConfig>>;
}

/** Generate a simple ID for messages and sessions */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Auto-generate a session title from the first user message */
export function generateSessionTitle(message: string): string {
  const cleaned = message.trim().replace(/\n/g, ' ');
  if (cleaned.length <= 40) return cleaned;
  return `${cleaned.slice(0, 37)}...`;
}
