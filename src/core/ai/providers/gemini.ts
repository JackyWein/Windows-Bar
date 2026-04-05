import type {
  AIProvider,
  AIModel,
  ChatMessage,
  ProviderConfig,
  AIRequest,
} from '../types';

const GEMINI_MODELS: readonly AIModel[] = [
  {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    description: 'Best for complex tasks',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast and versatile',
  },
] as const;

interface GeminiPart {
  readonly text: string;
}

interface GeminiContent {
  readonly role: 'user' | 'model';
  readonly parts: readonly GeminiPart[];
}

interface GeminiBody {
  readonly contents: readonly GeminiContent[];
}

function mapRole(role: ChatMessage['role']): GeminiContent['role'] {
  switch (role) {
    case 'assistant':
      return 'model';
    case 'user':
      return 'user';
    case 'system':
      return 'user';
  }
}

export const geminiProvider: AIProvider = {
  id: 'google-gemini',
  name: 'Google Gemini',
  type: 'api',
  description: 'Google Gemini models via API',
  models: GEMINI_MODELS,

  validateConfig(config: ProviderConfig): boolean {
    return typeof config.apiKey === 'string' && config.apiKey.length > 0;
  },

  buildRequest(
    messages: readonly ChatMessage[],
    modelId: string,
    config: ProviderConfig,
  ): AIRequest {
    const systemMessages: readonly ChatMessage[] = messages.filter(
      (msg) => msg.role === 'system',
    );
    const nonSystemMessages: readonly ChatMessage[] = messages.filter(
      (msg) => msg.role !== 'system' && msg.content.trim().length > 0,
    );

    const contents: GeminiContent[] = [];

    for (const sys of systemMessages) {
      const trimmed = sys.content.trim();
      if (trimmed.length === 0) continue;
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${trimmed}` }],
      });
    }

    for (const msg of nonSystemMessages) {
      contents.push({
        role: mapRole(msg.role),
        parts: [{ text: msg.content }],
      });
    }

    const body: GeminiBody = {
      contents,
    };

    return {
      providerId: 'google-gemini',
      providerType: 'api',
      modelId,
      url: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
      headers: {
        'content-type': 'application/json',
      },
      body,
    };
  },
};
