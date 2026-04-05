import type { AIProvider, AIModel, ChatMessage, ProviderConfig, AIRequest } from '../types';

const OPENAI_MODELS: readonly AIModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable general model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
  { id: 'o3-mini', name: 'o3-mini', description: 'Strong reasoning, efficient' },
] as const;

export const openaiProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI',
  type: 'api',
  description: 'OpenAI GPT and o-series models',
  models: OPENAI_MODELS,

  validateConfig(config: ProviderConfig): boolean {
    const key = config.apiKey;
    return typeof key === 'string' && key.length > 0;
  },

  buildRequest(
    messages: readonly ChatMessage[],
    modelId: string,
    config: ProviderConfig,
  ): AIRequest {
    const converted = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    return {
      providerId: 'openai',
      providerType: 'api',
      modelId,
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: {
        model: modelId,
        stream: true,
        messages: converted,
      },
    };
  },
};
