// ========================
// PLUGIN REGISTRY
// ========================

import type { SearchResult, ViewMode, AppSettings } from '../../types';
import type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginLogger,
  PluginCommand,
  PluginSearchProvider,
  PluginHookName,
  PluginHook,
  PluginAPI,
} from './types';

// ========================
// GLOBAL PLUGIN STATE
// ========================

const loadedPlugins = new Map<string, Plugin>();
const pluginCommands = new Map<string, PluginCommand>();
const searchProviders = new Map<string, PluginSearchProvider>();
const pluginHooks = new Map<string, Map<PluginHookName, PluginHook<PluginHookName>>>();
const pluginSettings = new Map<string, Record<string, unknown>>();

// Settings update callback
let onSettingsUpdate: ((pluginId: string, settings: Record<string, unknown>) => void) | null = null;

export function setSettingsUpdateCallback(callback: (pluginId: string, settings: Record<string, unknown>) => void) {
  onSettingsUpdate = callback;
}

// ========================
// PLUGIN LOGGER
// ========================

function createLogger(pluginId: string): PluginLogger {
  const prefix = `[Plugin:${pluginId}]`;
  return {
    log: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

// ========================
// PLUGIN CONTEXT FACTORY
// ========================

function createPluginContext(
  pluginId: string,
  appSettings: AppSettings,
  navigate: (view: ViewMode) => void,
  showResults: (results: SearchResult[]) => void,
): PluginContext {
  const logger = createLogger(pluginId);
  const settings = pluginSettings.get(pluginId) || {};
  
  return {
    settings: appSettings,
    pluginSettings: settings,
    navigate,
    showResults,
    api: window.electronAPI,
    logger,
    updateSetting: (key: string, value: unknown) => {
      const current = pluginSettings.get(pluginId) || {};
      const updated = { ...current, [key]: value };
      pluginSettings.set(pluginId, updated);
      onSettingsUpdate?.(pluginId, updated);
    },
  };
}

// ========================
// PLUGIN API (exposed to plugins)
// ========================

function createPluginAPI(pluginId: string): PluginAPI {
  return {
    getPlugin: (id: string) => loadedPlugins.get(id),
    getPluginSettings: (id: string) => pluginSettings.get(id) || {},
    
    registerCommand: (command: PluginCommand) => {
      const fullId = `${pluginId}:${command.id}`;
      pluginCommands.set(fullId, { ...command, id: fullId });
      logger.log(`Registered command: ${fullId}`);
    },
    
    unregisterCommand: (commandId: string) => {
      const fullId = `${pluginId}:${commandId}`;
      pluginCommands.delete(fullId);
    },
    
    registerSearchProvider: (provider: PluginSearchProvider) => {
      searchProviders.set(pluginId, provider);
      logger.log(`Registered search provider: ${provider.name}`);
    },
    
    unregisterSearchProvider: () => {
      searchProviders.delete(pluginId);
    },
    
    registerHook: <N extends PluginHookName>(hookName: N, hook: PluginHook<N>) => {
      if (!pluginHooks.has(pluginId)) {
        pluginHooks.set(pluginId, new Map());
      }
      pluginHooks.get(pluginId)!.set(hookName, hook as PluginHook<PluginHookName>);
      logger.log(`Registered hook: ${hookName}`);
    },
    
    unregisterHook: (hookName: PluginHookName) => {
      pluginHooks.get(pluginId)?.delete(hookName);
    },
    
    showNotification: (message: string, type: 'info' | 'success' | 'error' = 'info') => {
      // For now, just log - could be extended to show toast notifications
      const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
      console.log(`${emoji} [${pluginId}] ${message}`);
    },
    
    executeCommand: async (commandId: string, args?: string) => {
      const command = pluginCommands.get(commandId);
      if (!command) {
        throw new Error(`Command not found: ${commandId}`);
      }
      // This would need proper context - simplified for now
      return { commandId, args };
    },
  };
}

const logger = {
  log: (...args: unknown[]) => console.log('[PluginRegistry]', ...args),
  warn: (...args: unknown[]) => console.warn('[PluginRegistry]', ...args),
  error: (...args: unknown[]) => console.error('[PluginRegistry]', ...args),
};

// ========================
// PLUGIN REGISTRY API
// ========================

export const pluginRegistry = {
  // Get all loaded plugins
  getAll: (): Plugin[] => {
    return Array.from(loadedPlugins.values());
  },
  
  // Get a specific plugin
  get: (id: string): Plugin | undefined => {
    return loadedPlugins.get(id);
  },
  
  // Check if plugin is loaded
  isLoaded: (id: string): boolean => {
    return loadedPlugins.get(id)?._loaded === true;
  },
  
  // Register a plugin from manifest (called after install)
  register: (manifest: PluginManifest, settings?: Record<string, unknown>): Plugin => {
    const plugin: Plugin = {
      manifest,
      enabled: true,
      installed: true,
      settings: settings || manifest.defaultSettings || {},
    };
    
    loadedPlugins.set(manifest.id, plugin);
    pluginSettings.set(manifest.id, plugin.settings);
    
    logger.log(`Registered plugin: ${manifest.name} v${manifest.version}`);
    return plugin;
  },
  
  // Unregister a plugin
  unregister: (id: string): void => {
    loadedPlugins.delete(id);
    pluginCommands.forEach((_, key) => {
      if (key.startsWith(`${id}:`)) {
        pluginCommands.delete(key);
      }
    });
    searchProviders.delete(id);
    pluginHooks.delete(id);
    pluginSettings.delete(id);
    logger.log(`Unregistered plugin: ${id}`);
  },
  
  // Load plugin runtime (execute plugin code)
  load: async (
    pluginId: string,
    appSettings: AppSettings,
    navigate: (view: ViewMode) => void,
    showResults: (results: SearchResult[]) => void,
  ): Promise<boolean> => {
    const plugin = loadedPlugins.get(pluginId);
    if (!plugin) {
      logger.error(`Plugin not found: ${pluginId}`);
      return false;
    }
    
    if (plugin._loaded) {
      logger.warn(`Plugin already loaded: ${pluginId}`);
      return true;
    }
    
    if (!plugin.enabled) {
      logger.warn(`Plugin is disabled: ${pluginId}`);
      return false;
    }
    
    try {
      // Create context and API for the plugin
      const ctx = createPluginContext(pluginId, appSettings, navigate, showResults);
      const api = createPluginAPI(pluginId);
      
      // Try to load and execute plugin code
      // In a real implementation, this would load the plugin's main.js
      // For now, we'll use a simpler approach with manifest-based plugins
      
      // Execute onLoad hook if exists
      const hooks = pluginHooks.get(pluginId);
      if (hooks?.has('onLoad')) {
        const onLoad = hooks.get('onLoad') as (ctx: PluginContext, api: PluginAPI) => void | Promise<void>;
        await onLoad(ctx, api);
      }
      
      plugin._loaded = true;
      plugin._error = undefined;
      
      logger.log(`Loaded plugin: ${pluginId}`);
      return true;
    } catch (error) {
      plugin._loaded = false;
      plugin._error = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load plugin ${pluginId}:`, error);
      return false;
    }
  },
  
  // Unload plugin runtime
  unload: async (pluginId: string): Promise<void> => {
    const plugin = loadedPlugins.get(pluginId);
    if (!plugin || !plugin._loaded) return;
    
    try {
      // Execute onUnload hook
      const hooks = pluginHooks.get(pluginId);
      if (hooks?.has('onUnload')) {
        const onUnload = hooks.get('onUnload') as () => void | Promise<void>;
        await onUnload();
      }
      
      plugin._loaded = false;
      logger.log(`Unloaded plugin: ${pluginId}`);
    } catch (error) {
      logger.error(`Error unloading plugin ${pluginId}:`, error);
    }
  },
  
  // Enable/disable plugin
  setEnabled: (pluginId: string, enabled: boolean): void => {
    const plugin = loadedPlugins.get(pluginId);
    if (plugin) {
      plugin.enabled = enabled;
      if (!enabled) {
        plugin._loaded = false;
      }
      logger.log(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  },
  
  // Update plugin settings
  updateSettings: (pluginId: string, settings: Record<string, unknown>): void => {
    const plugin = loadedPlugins.get(pluginId);
    if (plugin) {
      plugin.settings = { ...plugin.settings, ...settings };
      pluginSettings.set(pluginId, plugin.settings);
    }
  },
  
  // Get all registered commands
  getCommands: (): PluginCommand[] => {
    return Array.from(pluginCommands.values());
  },
  
  // Get all search providers
  getSearchProviders: (): PluginSearchProvider[] => {
    return Array.from(searchProviders.values());
  },
  
  // Execute search across all providers
  search: async (
    query: string,
    appSettings: AppSettings,
    navigate: (view: ViewMode) => void,
    showResults: (results: SearchResult[]) => void,
  ): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    
    for (const [pluginId, provider] of searchProviders) {
      const plugin = loadedPlugins.get(pluginId);
      if (!plugin || !plugin.enabled || !plugin._loaded) continue;
      
      try {
        const ctx = createPluginContext(pluginId, appSettings, navigate, showResults);
        const providerResults = await provider.search(query, ctx);
        results.push(...providerResults);
      } catch (error) {
        logger.error(`Search provider ${provider.name} error:`, error);
      }
    }
    
    // Sort by priority
    const providers = Array.from(searchProviders.values());
    results.sort((a, b) => {
      const aProvider = providers.find(p => p.id === a.type);
      const bProvider = providers.find(p => p.id === b.type);
      return (aProvider?.priority || 100) - (bProvider?.priority || 100);
    });
    
    return results;
  },
  
  // Execute a hook
  executeHook: async <N extends PluginHookName>(
    hookName: N,
    ...args: Parameters<PluginHook<N>>
  ): Promise<void> => {
    for (const [pluginId, hooks] of pluginHooks) {
      const plugin = loadedPlugins.get(pluginId);
      if (!plugin || !plugin.enabled || !plugin._loaded) continue;
      
      const hook = hooks.get(hookName) as PluginHook<N> | undefined;
      if (hook) {
        try {
          await hook(...args);
        } catch (error) {
          logger.error(`Hook ${hookName} error in ${pluginId}:`, error);
        }
      }
    }
  },
  
  // Get plugin settings
  getSettings: (pluginId: string): Record<string, unknown> => {
    return pluginSettings.get(pluginId) || {};
  },
};

export default pluginRegistry;