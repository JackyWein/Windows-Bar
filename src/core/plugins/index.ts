// ========================
// PLUGIN SYSTEM EXPORTS
// ========================

export * from './types';
export { pluginRegistry, setSettingsUpdateCallback } from './registry';

// Re-export types
export type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginLogger,
  PluginCommand,
  PluginSearchProvider,
  PluginHookName,
  PluginHook,
  PluginAPI,
  PluginSettingSchema,
} from './types';