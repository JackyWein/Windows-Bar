// Plugin Manager - handles installation, loading, and lifecycle of plugins
import { app, ipcMain, BrowserWindow } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import Module from 'module';
import { executeInSandbox, validateManifest, type SandboxResult } from './sandbox';

// Hook into Node's module resolution to allow plugins in APPDATA to access the host app's node_modules
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      try {
        // Fallback to resolving from this file's context (which has access to the app's node_modules)
        return originalResolveFilename.call(this, request, module, isMain, options);
      } catch {
        throw err; // Throw original error if still not found
      }
    }
    throw err;
  }
};

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  enabled: boolean;
  installedAt: number;
  settings: Record<string, any>;
  error?: string;
}

// Plugin state
const pluginsDir = join(app.getPath('userData'), 'plugins');
const loadedPlugins = new Map<string, any>();
const pluginActions = new Map<string, Map<string, Function>>();
export const pluginCommandHandlers = new Map<string, Map<string, Function>>();
export const pluginSearchProviders = new Map<string, Map<string, Function>>();

// Ensure plugins directory exists
export async function ensurePluginsDir(): Promise<string> {
  await fs.mkdir(pluginsDir, { recursive: true });
  return pluginsDir;
}

// Only allow safe plugin IDs (prevents path traversal out of the plugins dir).
function isValidPluginId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9._-]+$/.test(id) && !id.includes('..');
}

// Get plugin directory
export function getPluginDir(pluginId: string): string {
  if (!isValidPluginId(pluginId)) throw new Error(`Ungültige Plugin-ID: ${pluginId}`);
  return join(pluginsDir, pluginId);
}

// List all installed plugins
export async function listPlugins(): Promise<PluginInfo[]> {
  await ensurePluginsDir();
  const plugins: PluginInfo[] = [];

  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = join(pluginsDir, entry.name, 'manifest.json');
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
        if (!validateManifest(manifest)) continue;

        const settingsPath = join(pluginsDir, entry.name, 'settings.json');
        let settings: Record<string, any> = {};
        try {
          settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        } catch { /* no settings */ }

        const stat = await fs.stat(join(pluginsDir, entry.name));

        plugins.push({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author || 'Unknown',
          icon: manifest.icon,
          // We default to true here; SettingsView or appSettings overrides this
          enabled: true,
          installedAt: stat.birthtimeMs,
          settings,
        });
      } catch { /* invalid plugin */ }
    }
  } catch (err) {
    console.error('[Plugins] Failed to list plugins:', err);
  }

  return plugins;
}

// Install plugin from local path (ZIP or folder)
export async function installPlugin(source: string): Promise<PluginInfo | null> {
  await ensurePluginsDir();

  try {
    const manifestPath = join(source, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

    if (!validateManifest(manifest)) {
      throw new Error('Invalid plugin manifest');
    }

    const pluginId = manifest.id;
    if (!isValidPluginId(pluginId)) {
      throw new Error('Ungültige Plugin-ID (erlaubt: a-z, A-Z, 0-9, ._-)');
    }
    const destDir = getPluginDir(pluginId);

    await fs.cp(source, destDir, { recursive: true });

    const settingsPath = join(destDir, 'settings.json');
    const defaultSettings = manifest.defaultSettings || {};
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));

    console.log(`[Plugins] Installed plugin: ${manifest.name} v${manifest.version}`);

    await loadPlugin(pluginId);

    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author || 'Unknown',
      icon: manifest.icon,
      enabled: true,
      installedAt: Date.now(),
      settings: defaultSettings,
    };
  } catch (err) {
    console.error('[Plugins] Failed to install plugin:', err);
    throw err;
  }
}

// Uninstall plugin
export async function uninstallPlugin(pluginId: string): Promise<boolean> {
  try {
    const pluginDir = getPluginDir(pluginId);
    await fs.rm(pluginDir, { recursive: true, force: true });
    loadedPlugins.delete(pluginId);
    pluginActions.delete(pluginId);
    pluginCommandHandlers.delete(pluginId);
    pluginSearchProviders.delete(pluginId);
    console.log(`[Plugins] Uninstalled plugin: ${pluginId}`);
    return true;
  } catch (err) {
    console.error('[Plugins] Failed to uninstall plugin:', err);
    return false;
  }
}

// Load a single plugin
export async function loadPlugin(pluginId: string): Promise<boolean> {
  try {
    const pluginDir = getPluginDir(pluginId);
    const manifestPath = join(pluginDir, 'manifest.json');
    const mainPath = join(pluginDir, 'main.js');

    await fs.access(manifestPath);
    await fs.access(mainPath);

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    if (!validateManifest(manifest)) {
      throw new Error('Invalid manifest');
    }

    const settingsPath = join(pluginDir, 'settings.json');
    let settings: Record<string, any> = {};
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    } catch { /* use defaults */ }

    // Initialize fresh handler caches for this load
    pluginCommandHandlers.set(pluginId, new Map());
    pluginSearchProviders.set(pluginId, new Map());

    const win = BrowserWindow.getAllWindows()[0];
    const sandboxCtx = createSandboxContext(pluginId, settings, win);

    const result: SandboxResult = await executeInSandbox(mainPath, sandboxCtx);

    if (result.success && result.exports) {
      loadedPlugins.set(pluginId, { manifest, settings, exports: result.exports, id: pluginId });
      console.log(`[Plugins] Loaded plugin: ${manifest.name}`);
    } else {
      console.error(`[Plugins] Failed to execute plugin main.js: ${pluginId}`, result.error);
      return false;
    }

    const pluginExports = result.exports;

    const playerPath = join(pluginDir, 'player.js');
    try {
      await fs.access(playerPath);
      delete require.cache[require.resolve(playerPath)];
      let playerModule;
      try {
        playerModule = require(playerPath);
      } catch (requireErr) {
        console.error(`[Plugin:${pluginId}] Error requiring player.js:`, (requireErr as Error).message);
      }

      if (playerModule && typeof playerModule === 'object') {
        const actions = new Map<string, Function>();
        for (const [key, value] of Object.entries(playerModule)) {
          if (typeof value === 'function') {
            actions.set(key, value);
          }
        }
        pluginActions.set(pluginId, actions);
        console.log(`[Plugin:${pluginId}] Registered ${actions.size} main process actions:`, Array.from(actions.keys()));
      } else {
        console.error(`[Plugin:${pluginId}] player.js did not export an object`);
      }
    } catch (err) {
      console.error(`[Plugin:${pluginId}] Error loading player.js:`, (err as Error).message);
    }

    if (typeof pluginExports.init === 'function') {
      try {
        pluginExports.init(sandboxCtx.ctx, sandboxCtx.api);
      } catch (err) {
        console.error(`[Plugin:${pluginId}] init() error:`, err);
      }
    }

    return true;
  } catch (err) {
    console.error(`[Plugins] Failed to load plugin ${pluginId}:`, err);
    return false;
  }
}

// Load all plugins installed in pluginsDir
export async function loadAllPlugins() {
  try {
    await ensurePluginsDir();
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    const pluginDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const pluginId of pluginDirs) {
      await loadPlugin(pluginId);
    }
  } catch (err) {
    console.error('[Plugins] Error loading plugins:', err);
  }
}

// Toggle enabled state of a plugin
export async function togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
  try {
    const win = BrowserWindow.getAllWindows()[0];

    if (enabled) {
      const success = await loadPlugin(pluginId);
      if (success && win) {
        win.webContents.send('plugin:reload-commands', { pluginId });
      }
      return success;
    } else {
      loadedPlugins.delete(pluginId);
      pluginActions.delete(pluginId);
      pluginCommandHandlers.delete(pluginId);
      pluginSearchProviders.delete(pluginId);

      if (win) {
        win.webContents.send('plugin:unregister-commands', { pluginId });
      }

      return true;
    }
  } catch (err) {
    console.error(`[Plugins] Error toggling plugin ${pluginId}:`, err);
    return false;
  }
}

// Get plugin settings
export async function getPluginSettings(pluginId: string): Promise<Record<string, any>> {
  const settingsPath = join(getPluginDir(pluginId), 'settings.json');
  try {
    return JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
  } catch {
    return {};
  }
}

// Update plugin settings
export async function updatePluginSettings(pluginId: string, settings: Record<string, any>): Promise<boolean> {
  try {
    const settingsPath = join(getPluginDir(pluginId), 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    const plugin = loadedPlugins.get(pluginId);
    if (plugin) {
      plugin.settings = settings;
    }

    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('plugin:settings-updated', { pluginId, settings });

    return true;
  } catch (err) {
    console.error(`[Plugins] Failed to update settings for ${pluginId}:`, err);
    return false;
  }
}

// Get plugin manifest
export async function getPluginManifest(pluginId: string): Promise<any | null> {
  try {
    const manifestPath = join(getPluginDir(pluginId), 'manifest.json');
    return JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

export const resultActionMap = new Map<string, Function>();

// Helper to strip non-serializable properties from objects, mapping functions to IPC action IDs
function stripNonSerializable(obj: any, keepHandler = false): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'function') {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    resultActionMap.set(actionId, obj);
    return { __plugin_action_id: actionId };
  }
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(item => stripNonSerializable(item, keepHandler));
    }
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'handler' && keepHandler) {
        result[key] = value;
      } else {
        result[key] = stripNonSerializable(value, keepHandler);
      }
    }
    return result;
  }
  return obj;
}

// Register IPC handlers for plugin API
export function registerPluginIPC() {
  ipcMain.handle('plugin:list', async () => {
    return await listPlugins();
  });

  ipcMain.handle('plugin:install', async (_event, source: string) => {
    return await installPlugin(source);
  });

  ipcMain.handle('plugin:uninstall', async (_event, id: string) => {
    return await uninstallPlugin(id);
  });

  ipcMain.handle('plugin:toggle', async (_event, id: string, enabled: boolean) => {
    return await togglePlugin(id, enabled);
  });

  ipcMain.handle('plugin:get-path', async () => {
    return pluginsDir;
  });

  ipcMain.handle('plugin:reload', async (_event, id: string) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('plugin:unregister-commands', { pluginId: id });
    }
    const success = await loadPlugin(id);
    if (success && win) {
      win.webContents.send('plugin:reload-commands', { pluginId: id });
    }
    return success;
  });

  ipcMain.handle('plugin:get-settings', async (_event, id: string) => {
    const plugin = loadedPlugins.get(id);
    return plugin ? plugin.settings : {};
  });

  ipcMain.handle('plugin:update-settings', async (_event, id: string, settings: any) => {
    const plugin = loadedPlugins.get(id);
    if (!plugin) return false;

    plugin.settings = { ...plugin.settings, ...settings };

    try {
      const settingsPath = join(getPluginDir(id), 'settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(plugin.settings, null, 2));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('plugin:get-manifest', async (_event, id: string) => {
    const plugin = loadedPlugins.get(id);
    return plugin ? plugin.manifest : null;
  });

  ipcMain.handle('plugin:request-commands', async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return { success: false };

    for (const [pluginId, plugin] of loadedPlugins.entries()) {
      const pluginExports = plugin.exports;
      if (pluginExports && typeof pluginExports.init === 'function') {
        try {
          const sandboxCtx = createSandboxContext(pluginId, plugin.settings, win);
          pluginCommandHandlers.set(pluginId, new Map());
          pluginSearchProviders.set(pluginId, new Map());
          pluginExports.init(sandboxCtx.ctx, sandboxCtx.api);
        } catch (err) {
          console.error(`[Plugin:${pluginId}] init() error on request-commands:`, err);
        }
      }
    }
    return { success: true };
  });

  ipcMain.handle('plugin:invoke-action', async (_event, pluginId: string, action: string, args: any) => {
    try {
      const actions = pluginActions.get(pluginId);
      if (actions && actions.has(action)) {
        return await actions.get(action)!(args);
      }
      throw new Error(`Action ${action} not found in plugin ${pluginId}`);
    } catch (err: any) {
      console.error(`[Plugins] invoke-action error for ${pluginId}:${action}:`, err);
      throw err;
    }
  });

  ipcMain.handle('plugin:invoke-command', async (_event, pluginId: string, commandId: string, args: string) => {
    try {
      const handlers = pluginCommandHandlers.get(pluginId);
      if (handlers && handlers.has(commandId)) {
        const plugin = loadedPlugins.get(pluginId);
        const win = BrowserWindow.getAllWindows()[0];
        const ctx = createSandboxContext(pluginId, plugin?.settings || {}, win).ctx;
        const result = await handlers.get(commandId)!(args, ctx);
        return stripNonSerializable(result);
      }
      throw new Error(`Command handler ${commandId} not found`);
    } catch (err: any) {
      console.error(`[Plugins] invoke-command error for ${commandId}:`, err);
      throw err;
    }
  });

  ipcMain.handle('plugin:invoke-search', async (_event, pluginId: string, providerId: string, query: string) => {
    try {
      const providers = pluginSearchProviders.get(pluginId);
      if (providers && providers.has(providerId)) {
        const plugin = loadedPlugins.get(pluginId);
        const win = BrowserWindow.getAllWindows()[0];
        const ctx = createSandboxContext(pluginId, plugin?.settings || {}, win).ctx;
        const result = await providers.get(providerId)!(query, ctx);
        return stripNonSerializable(result);
      }
      return [];
    } catch (err: any) {
      console.error(`[Plugins] invoke-search error for ${providerId}:`, err);
      return [];
    }
  });

  ipcMain.handle('plugin:sign-in', async (_event, pluginId: string) => {
    try {
      console.log(`[IPC] plugin:sign-in called for ${pluginId}`);
      const actions = pluginActions.get(pluginId);
      if (!actions) {
        console.log(`[IPC] No actions found for plugin ${pluginId}`);
        return { success: false, message: 'Sign-in not supported by this plugin (no actions)' };
      }
      console.log(`[IPC] Actions found for ${pluginId}:`, Array.from(actions.keys()));
      if (actions.has('signIn')) {
        console.log(`[IPC] Executing signIn for ${pluginId}`);
        const result = await actions.get('signIn')!();
        return { success: true, ...result };
      }
      return { success: false, message: 'Sign-in not supported by this plugin' };
    } catch (err: any) {
      console.error(`[Plugins] Sign-in error for ${pluginId}:`, err);
      return { success: false, message: `Sign-in failed: ${err.message}` };
    }
  });
  ipcMain.handle('plugin:execute-result-action', async (_event, actionId: string) => {
    const action = resultActionMap.get(actionId);
    if (action) {
      try {
        await action();
      } catch (err) {
        console.error(`[Plugins] Error executing result action ${actionId}:`, err);
      }
    } else {
      console.warn(`[Plugins] Action not found: ${actionId}`);
    }
  });
}

function createSandboxContext(pluginId: string, settings: Record<string, any>, win: Electron.BrowserWindow) {
  return {
    ctx: {
      logger: {
        log: (...args: any[]) => console.log(`[Plugin:${pluginId}]`, ...args),
        warn: (...args: any[]) => console.warn(`[Plugin:${pluginId}]`, ...args),
        error: (...args: any[]) => console.error(`[Plugin:${pluginId}]`, ...args),
      },
      settings: {},
      pluginSettings: settings,
      navigate: (view: string) => {
        if (win) win.webContents.send('plugin:navigate', { pluginId, view });
      },
      showResults: (results: any[]) => {
        if (win) win.webContents.send('plugin:results', { pluginId, results: stripNonSerializable(results) });
      },
      updateSetting: async (key: string, value: any) => {
        settings[key] = value;
        try {
          const settingsPath = join(getPluginDir(pluginId), 'settings.json');
          await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        } catch { /* ignore */ }
        if (win) win.webContents.send('plugin:settings-updated', { pluginId, settings });
      },
    },
    api: {
      registerCommand: (command: any) => {
        if (!pluginCommandHandlers.has(pluginId)) pluginCommandHandlers.set(pluginId, new Map());
        pluginCommandHandlers.get(pluginId)!.set(command.id, command.handler);
        if (win) win.webContents.send('plugin:command', { pluginId, command: stripNonSerializable(command, false) });
      },
      registerSearchProvider: (provider: any) => {
        if (!pluginSearchProviders.has(pluginId)) pluginSearchProviders.set(pluginId, new Map());
        // Use name as ID for search providers if id is not available
        const providerId = provider.id || provider.name || 'default';
        pluginSearchProviders.get(pluginId)!.set(providerId, provider.search);
        
        // Pass the resolved id as well
        const safeProvider = stripNonSerializable(provider, false);
        safeProvider.id = providerId;
        if (win) win.webContents.send('plugin:search-provider', { pluginId, provider: safeProvider });
      },
      registerHook: (_hookName: string, _hook: Function) => {
        console.log(`[Plugin:${pluginId}] Registered hook: ${_hookName}`);
      },
      invokeMainAction: async (action: string, args?: any) => {
        const actions = pluginActions.get(pluginId);
        if (!actions || !actions.has(action)) {
          throw new Error(`Action not found: ${action}`);
        }
        return actions.get(action)!(args);
      },
      showNotification: (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        win.webContents.send('plugin:notification', { pluginId, message, type });
      },
    },
  };
}