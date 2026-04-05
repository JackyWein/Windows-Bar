import type { PluginInfo } from '../../types';

/** IPC shape exposed by the main process via preload. */
interface PluginIPC {
  list: () => Promise<PluginInfo[]>;
  install: (folderPath: string) => Promise<PluginInfo>;
  uninstall: (pluginId: string) => Promise<void>;
}

function getPluginIPC(): PluginIPC | null {
  const api = (window as unknown as Record<string, unknown>).electronAPI;
  if (api && typeof api === 'object' && 'pluginAPI' in api) {
    return api.pluginAPI as PluginIPC;
  }
  return null;
}

export class PluginManager {
  private readonly enabledPlugins: Map<string, boolean>;

  constructor(enabledPlugins: Record<string, boolean>) {
    this.enabledPlugins = new Map(Object.entries(enabledPlugins));
  }

  /**
   * Fetch the full list of plugins from the main process and
   * merge with local enabled state.
   */
  async getPluginList(): Promise<PluginInfo[]> {
    const ipc = getPluginIPC();
    if (!ipc) return [];

    const plugins = await ipc.list();

    return plugins.map((plugin) => ({
      ...plugin,
      enabled: this.enabledPlugins.get(plugin.id) ?? plugin.enabled,
    }));
  }

  isPluginEnabled(id: string): boolean {
    return this.enabledPlugins.get(id) ?? false;
  }

  togglePlugin(id: string, enabled: boolean): void {
    this.enabledPlugins.set(id, enabled);
  }

  /** Persist current enabled map back to a plain object for storage. */
  getEnabledSnapshot(): Record<string, boolean> {
    return Object.fromEntries(this.enabledPlugins);
  }

  async installFromFolder(path: string): Promise<PluginInfo> {
    const ipc = getPluginIPC();
    if (!ipc) {
      throw new Error('Plugin IPC bridge is not available');
    }

    const info = await ipc.install(path);
    // Newly installed plugins start as enabled
    this.enabledPlugins.set(info.id, true);
    return info;
  }

  async uninstall(id: string): Promise<void> {
    const ipc = getPluginIPC();
    if (!ipc) {
      throw new Error('Plugin IPC bridge is not available');
    }

    await ipc.uninstall(id);
    this.enabledPlugins.delete(id);
  }
}

/** Singleton instance — re-created when settings change. */
let instance: PluginManager | null = null;

export function initPluginManager(enabledPlugins: Record<string, boolean>): PluginManager {
  instance = new PluginManager(enabledPlugins);
  return instance;
}

export function getPluginManager(): PluginManager | null {
  return instance;
}

/** Convenience alias — the initially-created singleton. */
export const pluginManager: PluginManager = new PluginManager({});
