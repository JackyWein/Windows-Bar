// Plugin Manager - handles installation, loading, and lifecycle of plugins
import { app, ipcMain, BrowserWindow } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { executeInSandbox, validateManifest, type SandboxContext, type SandboxResult } from './sandbox';

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

// Ensure plugins directory exists
export async function ensurePluginsDir(): Promise<string> {
  await fs.mkdir(pluginsDir, { recursive: true });
  return pluginsDir;
}

// Get plugin directory
export function getPluginDir(pluginId: string): string {
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
    // For now, support local folder installation
    // Check if source is a valid plugin folder
    const manifestPath = join(source, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

    if (!validateManifest(manifest)) {
      throw new Error('Invalid plugin manifest');
    }

    const pluginId = manifest.id;
    const destDir = getPluginDir(pluginId);

    // Copy plugin folder
    await fs.cp(source, destDir, { recursive: true });

    // Create default settings file
    const settingsPath = join(destDir, 'settings.json');
    const defaultSettings = manifest.defaultSettings || {};
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));

    console.log(`[Plugins] Installed plugin: ${manifest.name} v${manifest.version}`);

    // Reload plugin
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

    // Check files exist
    await fs.access(manifestPath);
    await fs.access(mainPath);

    // Read manifest
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    if (!validateManifest(manifest)) {
      throw new Error('Invalid manifest');
    }

    // Read settings
    const settingsPath = join(pluginDir, 'settings.json');
    let settings: Record<string, any> = {};
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    } catch { /* use defaults */ }

    // Create sandbox context
    const sandboxCtx: SandboxContext = {
      ctx: {
        logger: {
          log: (...args: any[]) => console.log(`[Plugin:${pluginId}]`, ...args),
          warn: (...args: any[]) => console.warn(`[Plugin:${pluginId}]`, ...args),
          error: (...args: any[]) => console.error(`[Plugin:${pluginId}]`, ...args),
        },
        settings: {}, // Will be populated from main process
        pluginSettings: settings,
        navigate: (view: string) => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('plugin:navigate', { pluginId, view });
        },
        showResults: (results: any[]) => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('plugin:results', { pluginId, results });
        },
        updateSetting: async (key: string, value: any) => {
          settings[key] = value;
          try {
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
          } catch (err) {
            console.error(`[Plugin:${pluginId}] Failed to save settings:`, err);
          }
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('plugin:settings-updated', { pluginId, settings });
        },
      },
      api: {
        registerCommand: (command: any) => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('plugin:command', { pluginId, command });
        },
        registerSearchProvider: (provider: any) => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('plugin:search-provider', { pluginId, provider });
        },
        registerHook: (_hookName: string, _hook: Function) => {
          // Hooks are handled internally for now
          console.log(`[Plugin:${pluginId}] Registered hook: ${_hookName}`);
        },
        invokeMainAction: async (action: string, args?: any) => {
          // Route to plugin's main process handler (e.g., youtubei.js player)
          const actions = pluginActions.get(pluginId);
          if (!actions || !actions.has(action)) {
            throw new Error(`Action not found: ${action}`);
          }
          return actions.get(action)!(args);
        },
        showNotification: (message: string, type: 'info' | 'success' | 'error' = 'info') => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('plugin:notification', { pluginId, message, type });
        },
      },
    };

    // Execute plugin in sandbox
    const result: SandboxResult = await executeInSandbox(mainPath, sandboxCtx);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Call the plugin's init() function if it exists
    if (result.exports && typeof result.exports.init === 'function') {
      try {
        result.exports.init(sandboxCtx.ctx, sandboxCtx.api);
        console.log(`[Plugin:${pluginId}] init() called successfully`);
      } catch (err) {
        console.error(`[Plugin:${pluginId}] init() error:`, err);
        throw new Error(`Plugin init failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Store loaded plugin
    loadedPlugins.set(pluginId, {
      manifest,
      exports: result.exports,
      settings,
    });

    // Register main process actions if plugin has player.js
    const playerPath = join(pluginDir, 'player.js');
    try {
      await fs.access(playerPath);
      // Clear require cache for hot reload
      delete require.cache[require.resolve(playerPath)];
      const playerModule = require(playerPath);

      if (playerModule && typeof playerModule === 'object') {
        const actions = new Map<string, Function>();
        for (const [key, value] of Object.entries(playerModule)) {
          if (typeof value === 'function') {
            actions.set(key, value);
          }
        }
        pluginActions.set(pluginId, actions);
        console.log(`[Plugin:${pluginId}] Registered ${actions.size} main process actions`);
      }
    } catch { /* no player.js, skip */ }

    console.log(`[Plugins] Loaded plugin: ${manifest.name} v${manifest.version}`);
    return true;
  } catch (err) {
    console.error(`[Plugins] Failed to load plugin ${pluginId}:`, err);
    return false;
  }
}

// Load all plugins
export async function loadAllPlugins(): Promise<void> {
  await ensurePluginsDir();
  const plugins = await listPlugins();

  console.log(`[Plugins] Loading ${plugins.length} plugin(s)...`);

  for (const plugin of plugins) {
    if (plugin.enabled) {
      await loadPlugin(plugin.id);
    }
  }

  // Notify renderer about loaded plugins
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('plugin:list', plugins);
  }
}

// Toggle plugin enabled state
export async function togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
  try {
    const win = BrowserWindow.getAllWindows()[0];

    if (enabled) {
      const success = await loadPlugin(pluginId);
      // Notify renderer to re-register commands
      if (success && win) {
        win.webContents.send('plugin:reload-commands', { pluginId });
      }
      return success;
    } else {
      loadedPlugins.delete(pluginId);
      pluginActions.delete(pluginId);

      // Notify renderer to unregister plugin commands
      if (win) {
        win.webContents.send('plugin:unregister-commands', { pluginId });
      }

      return true;
    }
  } catch (err) {
    console.error(`[Plugins] Failed to toggle plugin ${pluginId}:`, err);
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

    // Update in-memory settings
    const plugin = loadedPlugins.get(pluginId);
    if (plugin) {
      plugin.settings = settings;
    }

    // Notify renderer
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

// Register IPC handlers
export function registerPluginIPC(): void {
  ipcMain.handle('plugin:install', async (_event, source: string) => {
    try {
      const plugin = await installPlugin(source);
      return { success: true, plugin };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('plugin:uninstall', async (_event, id: string) => {
    const success = await uninstallPlugin(id);
    return { success };
  });

  ipcMain.handle('plugin:reload', async (_event, id: string) => {
    const success = await loadPlugin(id);
    return { success };
  });

  ipcMain.handle('plugin:list', async () => {
    return await listPlugins();
  });

  ipcMain.handle('plugin:toggle', async (_event, id: string, enabled: boolean) => {
    const success = await togglePlugin(id, enabled);
    return { success };
  });

  ipcMain.handle('plugin:get-settings', async (_event, id: string) => {
    return await getPluginSettings(id);
  });

  ipcMain.handle('plugin:update-settings', async (_event, id: string, settings: Record<string, any>) => {
    const success = await updatePluginSettings(id, settings);
    return { success };
  });

  ipcMain.handle('plugin:get-manifest', async (_event, id: string) => {
    return await getPluginManifest(id);
  });

  ipcMain.handle('plugin:get-path', async () => {
    return pluginsDir;
  });

  // Invoke a main process action (e.g., youtubei.js player methods)
  ipcMain.handle('plugin:invoke-action', async (_event, pluginId: string, action: string, args?: any) => {
    try {
      const actions = pluginActions.get(pluginId);
      if (!actions || !actions.has(action)) {
        throw new Error(`Action "${action}" not found for plugin "${pluginId}"`);
      }
      return await actions.get(action)!(args);
    } catch (err: any) {
      console.error(`[Plugins] invoke-action error (${pluginId}:${action}):`, err.message);
      throw err;
    }
  });

   // Renderer requests all registered plugin commands (called on init)
   ipcMain.handle('plugin:request-commands', async () => {
     const win = BrowserWindow.getAllWindows()[0];
     if (!win) return { success: false };

     for (const [pluginId] of loadedPlugins) {
       const plugin = loadedPlugins.get(pluginId);
       if (!plugin) continue;

       const pluginDir = getPluginDir(pluginId);
       const mainPath = join(pluginDir, 'main.js');
       const pluginSettings = plugin.settings;

       const sandboxCtx = createSandboxContext(pluginId, pluginSettings, win);

       try {
         const code = await fs.readFile(mainPath, 'utf-8');
         const wrappedCode = `(function(require, module, exports) { ${code} })`;
         const { Script, createContext } = await import('node:vm');
         const context = createContext(sandboxCtx as any);
         const script = new Script(wrappedCode);
         script.runInContext(context);
         const exports = context.module.exports;
         if (exports && typeof exports.init === 'function') {
           exports.init(sandboxCtx.ctx, sandboxCtx.api);
         }
       } catch (err) {
         console.error(`[Plugins] Re-init error for ${pluginId}:`, err);
       }
     }

     return { success: true };
   });

   // Handle plugin sign-in requests
   ipcMain.handle('plugin:sign-in', async (_event, pluginId: string) => {
     const win = BrowserWindow.getAllWindows()[0];
     if (!win) return { success: false, message: 'No window available' };

     const plugin = loadedPlugins.get(pluginId);
     if (!plugin) return { success: false, message: 'Plugin not loaded' };

     const pluginDir = getPluginDir(pluginId);
     const mainPath = join(pluginDir, 'main.js');
     const pluginSettings = plugin.settings;

     const sandboxCtx = createSandboxContext(pluginId, pluginSettings, win);

     try {
       const code = await fs.readFile(mainPath, 'utf-8');
       const wrappedCode = `(function(require, module, exports) { ${code} })`;
       const { Script, createContext } = await import('node:vm');
       const context = createContext(sandboxCtx as any);
       const script = new Script(wrappedCode);
       script.runInContext(context);
       const exports = context.module.exports;
       
       if (exports && typeof exports.signIn === 'function') {
         const result = await exports.signIn();
         return { success: true, ...result };
       } else {
         return { success: false, message: 'Sign-in not supported by this plugin' };
       }
     } catch (err: any) {
       console.error(`[Plugins] Sign-in error for ${pluginId}:`, err);
       return { success: false, message: `Sign-in failed: ${err.message}` };
     }
   });
}

// Helper to create sandbox context (shared between loadPlugin and request-commands)
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
        win.webContents.send('plugin:navigate', { pluginId, view });
      },
      showResults: (results: any[]) => {
        win.webContents.send('plugin:results', { pluginId, results });
      },
      updateSetting: async (key: string, value: any) => {
        settings[key] = value;
        try {
          const settingsPath = join(getPluginDir(pluginId), 'settings.json');
          await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        } catch { /* ignore */ }
        win.webContents.send('plugin:settings-updated', { pluginId, settings });
      },
    },
    api: {
      registerCommand: (command: any) => {
        win.webContents.send('plugin:command', { pluginId, command });
      },
      registerSearchProvider: (provider: any) => {
        win.webContents.send('plugin:search-provider', { pluginId, provider });
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
