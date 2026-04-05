import type {
  AIProvider,
  AIModel,
  ChatMessage,
  ProviderConfig,
  AIRequest,
} from '../types';

const ANTHROPIC_MODELS: readonly AIModel[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Best balance of speed and capability',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Most capable, slower',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest, most affordable',
  },
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  type: 'api',
  description: 'Anthropic Claude models via API',
  models: ANTHROPIC_MODELS,

  validateConfig(config: ProviderConfig): boolean {
    return isNonEmptyString(config.apiKey);
  },

  buildRequest(
    messages: readonly ChatMessage[],
    modelId: string,
    config: ProviderConfig,
  ): AIRequest {
    const systemMessages: readonly string[] = messages
      .filter((msg): msg is ChatMessage & { readonly role: 'system' } => msg.role === 'system')
      .map((msg) => msg.content);

    const systemText = systemMessages.length > 0 ? systemMessages.join('\n') : undefined;

    const conversationMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const headers: Record<string, string> = {
      'x-api-key': config.apiKey ?? '',
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: 4096,
      stream: true,
      messages: conversationMessages,
    };

    if (systemText !== undefined) {
      body.system = systemText;
    }

    return {
      providerId: 'anthropic',
      providerType: 'api',
      modelId,
      url: 'https://api.anthropic.com/v1/messages',
      headers,
      body,
    };
  },
};
