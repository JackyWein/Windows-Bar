import type {
  AIProvider,
  AIModel,
  ChatMessage,
  ProviderConfig,
  AIRequest,
} from '../types';

const GEMINI_CLI_MODELS: readonly AIModel[] = [
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    description: 'Google Gemini via CLI',
  },
] as const;

export function createCliProvider(
  id: string,
  name: string,
  command: string,
  models?: readonly AIModel[],
): AIProvider {
  const resolvedModels = models ?? GEMINI_CLI_MODELS;

  return {
    id,
    name,
    type: 'cli',
    description: `CLI provider: ${name}`,
    models: resolvedModels,

    validateConfig(_config: ProviderConfig): boolean {
      return true;
    },

    buildRequest(
      messages: readonly ChatMessage[],
      modelId: string,
      config: ProviderConfig,
    ): AIRequest {
      const activeCommand = config.cliCommand ?? command;

      const contextLines = messages
        .map((msg) => `[${msg.role}]: ${msg.content}`)
        .join('\n\n');

      const lastUserMessage = [...messages]
        .reverse()
        .find((msg) => msg.role === 'user');

      const cliInput = lastUserMessage
        ? `${contextLines}\n\n---\n${lastUserMessage.content}`
        : contextLines;

      return {
        providerId: id,
        providerType: 'cli',
        modelId,
        cliCommand: activeCommand,
        cliArgs: [],
        cliInput,
      };
    },
  };
}
