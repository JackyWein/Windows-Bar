// Renderer-side Plugin Loader
// Listens for plugin events from main process and integrates with the app
import { commandRegistry } from '../commands/registry';
import type { Command, SearchResult, ViewMode } from '../../types';

interface PluginState {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  commands: Command[];
  searchProviders: any[];
  settings: Record<string, unknown>;
}

const pluginStates = new Map<string, PluginState>();
let onNavigateCallback: ((view: ViewMode) => void) | null = null;
let onShowResultsCallback: ((results: SearchResult[]) => void) | null = null;

// Helper to recursively restore actions from their IPC string representation
function restorePluginActions(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object') {
    if (obj.__plugin_action_id && typeof obj.__plugin_action_id === 'string') {
      const actionId = obj.__plugin_action_id;
      return () => window.pluginAPI.executeResultAction(actionId);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => restorePluginActions(item));
    }
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = restorePluginActions(value);
    }
    return result;
  }
  return obj;
}

export function initPluginLoader(
  navigate: (view: ViewMode) => void,
  showResults: (results: SearchResult[]) => void
): void {
  onNavigateCallback = navigate;
  onShowResultsCallback = showResults;

  if (!window.pluginAPI) {
    console.warn('[PluginLoader] pluginAPI not available');
    return;
  }

  // Listen for plugin commands
  window.pluginAPI.onPluginCommand(({ pluginId, command }) => {
    console.log(`[PluginLoader] Command registered from ${pluginId}: ${command.id}`);
    const pluginState = getOrCreatePluginState(pluginId);
    const fullId = `plugin:${pluginId}:${command.id}`;

    const wrappedCommand: Command = {
      ...command,
      id: fullId,
      handler: async (args: string, _ctx) => {
        console.log(`[PluginLoader] Executing command ${fullId} with args:`, args);
        try {
          const result = await window.pluginAPI.invokeCommand(pluginId, command.id, args);
          const restoredResult = restorePluginActions(result);
          console.log(`[PluginLoader] Command ${fullId} result:`, restoredResult);
          return restoredResult;
        } catch (err) {
          console.error(`[PluginLoader] Command ${fullId} error:`, err);
          throw err;
        }
      },
      enabled: true,
    };

    commandRegistry.register(wrappedCommand);
    pluginState.commands.push(wrappedCommand);
  });

  // Listen for search providers
  window.pluginAPI.onPluginSearchProvider(({ pluginId, provider }) => {
    console.log(`[PluginLoader] Search provider registered from ${pluginId}: ${provider.name}`);
    const pluginState = getOrCreatePluginState(pluginId);
    pluginState.searchProviders.push({ ...provider, pluginId });
  });

  // Listen for plugin results
  window.pluginAPI.onPluginResults(({ pluginId, results }) => {
    console.log(`[PluginLoader] Results from ${pluginId}: ${results.length} items`);
    const restoredResults = restorePluginActions(results) as SearchResult[];
    if (onShowResultsCallback) {
      onShowResultsCallback(restoredResults);
    }
  });

  // Listen for notifications
  window.pluginAPI.onPluginNotification(({ pluginId, message, type }) => {
    console.log(`[Plugin:${pluginId}] ${type}: ${message}`);
  });

  // Listen for settings updates
  window.pluginAPI.onPluginSettingsUpdated(({ pluginId, settings }) => {
    console.log(`[PluginLoader] Settings updated for ${pluginId}`);
    const pluginState = pluginStates.get(pluginId);
    if (pluginState) {
      pluginState.settings = settings;
    }
  });

  // Listen for navigation requests
  window.pluginAPI.onPluginNavigate(({ pluginId, view }) => {
    console.log(`[PluginLoader] Navigation request from ${pluginId}: ${view}`);
    if (onNavigateCallback) {
      onNavigateCallback(view as ViewMode);
    }
  });

  // Listen for unregister commands (when plugin is disabled)
  window.pluginAPI.onPluginUnregisterCommands(({ pluginId }) => {
    console.log(`[PluginLoader] Unregistering commands for ${pluginId}`);
    commandRegistry.unregisterByPrefix(`plugin:${pluginId}:`);
    const state = pluginStates.get(pluginId);
    if (state) {
      state.enabled = false;
      state.commands = [];
    }
  });

  // Listen for reload commands (when plugin is re-enabled, needs to re-register)
  window.pluginAPI.onPluginReloadCommands(({ pluginId }) => {
    console.log(`[PluginLoader] Reloading commands for ${pluginId}`);
    commandRegistry.unregisterByPrefix(`plugin:${pluginId}:`);
    const state = pluginStates.get(pluginId);
    if (state) {
      state.enabled = true;
      state.commands = [];
    }
    // Re-register commands after unregistering
    window.pluginAPI.requestCommands().catch(() => {});
  });

  // Request all plugins to re-register their commands (called on init)
  window.pluginAPI.requestCommands().then(() => {
    console.log('[PluginLoader] Requested commands from all plugins');
  }).catch(() => {});

  // Load initial plugin list
  loadPluginList();
}

async function loadPluginList(): Promise<void> {
  try {
    const plugins = await window.pluginAPI.list();
    for (const plugin of plugins as any[]) {
      const state: PluginState = {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        enabled: plugin.enabled !== false,
        commands: [],
        searchProviders: [],
        settings: {},
      };
      pluginStates.set(plugin.id, state);

      // Load settings
      try {
        state.settings = await window.pluginAPI.getSettings(plugin.id);
      } catch { /* no settings */ }
    }
    console.log(`[PluginLoader] Loaded ${plugins.length} plugin(s)`);
  } catch (err) {
    console.error('[PluginLoader] Failed to load plugin list:', err);
  }
}

function getOrCreatePluginState(pluginId: string): PluginState {
  if (!pluginStates.has(pluginId)) {
    pluginStates.set(pluginId, {
      id: pluginId,
      name: pluginId,
      version: '0.0.0',
      enabled: true,
      commands: [],
      searchProviders: [],
      settings: {},
    });
  }
  return pluginStates.get(pluginId)!;
}

export async function searchWithPlugins(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  for (const [pluginId, state] of pluginStates) {
    if (!state.enabled) continue;

    for (const provider of state.searchProviders) {
      if (provider.triggers && provider.triggers.some((t: string) => query.startsWith(t))) {
        try {
          const providerId = provider.id || provider.name || 'default';
          const providerResults = await window.pluginAPI.invokeSearch(pluginId, providerId, query);
          results.push(...(providerResults as SearchResult[]));
        } catch (err) {
          console.error(`[PluginLoader] Search provider ${provider.name} error:`, err);
        }
      }
    }
  }

  return results;
}
