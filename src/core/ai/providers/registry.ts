// ========================
// Provider Registry
// ========================

import type { AIProvider, AIModel, ProviderConfig } from '../types';
import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { geminiProvider } from './gemini';
import { ollamaProvider } from './ollama';
import { createCliProvider } from './cli';
import { createCustomProvider } from './custom';

/** Built-in providers that are always available */
const BUILTIN_PROVIDERS: readonly AIProvider[] = [
  anthropicProvider,
  openaiProvider,
  geminiProvider,
  ollamaProvider,
  createCliProvider('gemini-cli', 'Gemini CLI', 'gemini'),
] as const;

class ProviderRegistry {
  private readonly providers: Map<string, AIProvider> = new Map();

  constructor() {
    for (const provider of BUILTIN_PROVIDERS) {
      this.providers.set(provider.id, provider);
    }
  }

  /** Get a provider by ID */
  getById(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  /** Get all registered providers */
  getAll(): readonly AIProvider[] {
    return Array.from(this.providers.values());
  }

  /** Get only enabled providers based on settings */
  getEnabled(configs: Readonly<Record<string, ProviderConfig>>): readonly AIProvider[] {
    return this.getAll().filter((p) => {
      const config = configs[p.id];
      return config ? config.enabled : false;
    });
  }

  /** Get only API-type providers */
  getApiProviders(): readonly AIProvider[] {
    return this.getAll().filter((p) => p.type === 'api');
  }

  /** Get only CLI-type providers */
  getCliProviders(): readonly AIProvider[] {
    return this.getAll().filter((p) => p.type === 'cli');
  }

  /** Check if a provider is built-in (not user-added) */
  isBuiltin(id: string): boolean {
    return BUILTIN_PROVIDERS.some((p) => p.id === id);
  }

  /** Get all available models across all enabled providers */
  getModelsForProvider(
    providerId: string,
    configs: Readonly<Record<string, ProviderConfig>>,
  ): readonly AIModel[] {
    const provider = this.getById(providerId);
    if (!provider) return [];

    const config = configs[providerId];
    if (config?.models && config.models.length > 0) return config.models;
    return provider.models;
  }

  /**
   * Register a custom provider (from user settings)
   * Returns the created provider or undefined if one with that ID already exists
   */
  registerCustom(
    id: string,
    name: string,
    endpoint: string,
    models: readonly AIModel[],
  ): AIProvider | undefined {
    if (this.providers.has(id)) return undefined;
    const provider = createCustomProvider(id, name, endpoint, models);
    this.providers.set(id, provider);
    return provider;
  }

  /** Remove a custom provider (built-in providers cannot be removed) */
  unregister(id: string): boolean {
    if (this.isBuiltin(id)) return false;
    return this.providers.delete(id);
  }
}

/** Singleton provider registry */
export const providerRegistry = new ProviderRegistry();
