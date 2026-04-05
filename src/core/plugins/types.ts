import type { Command } from '../../types';

/**
 * Context object passed to plugins during activation.
 * Provides registration helpers, settings access, and IPC bridge.
 */
export interface PluginContext {
  registerCommand: (command: Command) => void;
  registerSetting: (key: string, defaultValue: unknown) => void;
  getSetting: (key: string) => unknown;
  setSetting: (key: string, value: unknown) => void;
  showNotification: (message: string) => void;
  ipc: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    on: (channel: string, handler: (...args: unknown[]) => void) => void;
  };
}

/**
 * Shape a plugin module must export.
 * `activate` is called when the plugin is enabled,
 * `deactivate` is called when it is disabled or unloaded.
 */
export interface PluginModule {
  activate: (context: PluginContext) => void;
  deactivate?: () => void;
}
