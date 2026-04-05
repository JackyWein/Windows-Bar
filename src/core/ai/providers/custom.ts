import type {
  AIProvider,
  AIModel,
  ChatMessage,
  ProviderConfig,
  AIRequest,
} from '../types';

export function createCustomProvider(
  id: string,
  name: string,
  endpoint: string,
  models: readonly AIModel[],
): AIProvider {
  return {
    id,
    name,
    type: 'api',
    description: `Custom provider: ${name}`,
    models,

    validateConfig(config: ProviderConfig): boolean {
      if (config.apiKey && config.apiKey.length > 0) {
        return true;
      }

      const target = config.endpoint ?? endpoint;
      const isLocal =
        target.startsWith('http://localhost') ||
        target.startsWith('http://127.0.0.1') ||
        target.startsWith('http://[::1]');

      return isLocal;
    },

    buildRequest(
      messages: readonly ChatMessage[],
      modelId: string,
      config: ProviderConfig,
    ): AIRequest {
      const url = config.endpoint ?? endpoint;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (config.apiKey && config.apiKey.length > 0) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const body = {
        model: modelId,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: true,
      };

      return {
        providerId: id,
        providerType: 'api',
        modelId,
        url,
        headers,
        body,
      };
    },
  };
}
