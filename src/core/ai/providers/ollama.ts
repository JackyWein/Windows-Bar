import type { AIProvider, AIModel, ChatMessage, ProviderConfig, AIRequest } from '../types';

const OLLAMA_DEFAULT_MODELS: readonly AIModel[] = [
  { id: 'llama3', name: 'Llama 3', description: 'Meta Llama 3 8B' },
  { id: 'mistral', name: 'Mistral', description: 'Mistral 7B' },
  { id: 'codellama', name: 'Code Llama', description: 'Code-focused model' },
] as const;

const OLLAMA_ENDPOINT = 'http://localhost:11434/v1/chat/completions';

export const ollamaProvider: AIProvider = {
  id: 'ollama',
  name: 'Ollama (Local)',
  type: 'api',
  description: 'Local models via Ollama',
  models: OLLAMA_DEFAULT_MODELS,

  validateConfig(config: ProviderConfig): boolean {
    if (config.models != null && config.models.length > 0) {
      return true;
    }
    return true;
  },

  buildRequest(
    messages: readonly ChatMessage[],
    modelId: string,
    config: ProviderConfig,
  ): AIRequest {
    const payloadMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    return {
      providerId: 'ollama',
      providerType: 'api',
      modelId,
      url: OLLAMA_ENDPOINT,
      headers: {
        'content-type': 'application/json',
      },
      body: {
        model: modelId,
        stream: true,
        messages: payloadMessages,
      },
    };
  },
};
