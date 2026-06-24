// ========================
// PLUGIN SYSTEM TYPES
// ========================

import type { SearchResult, ViewMode, AppSettings, Command, CommandResult } from '../../types';

/**
 * Plugin Manifest - describes the plugin
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  icon?: string; // URL or base64
  minAppVersion?: string;
  
  // What the plugin provides
  provides: {
    commands?: boolean;
    searchProvider?: boolean;
    view?: boolean;
    settings?: boolean;
    hooks?: boolean;
  };
  
  // Plugin settings schema
  settingsSchema?: PluginSettingSchema[];
  
  // Default settings values
  defaultSettings?: Record<string, unknown>;
}

/**
 * Schema for plugin settings
 */
export interface PluginSettingSchema {
  key: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color';
  label: string;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[]; // for select type
  default?: unknown;
}

/**
 * Full Plugin interface with runtime data
 */
export interface Plugin {
  manifest: PluginManifest;
  enabled: boolean;
  installed: boolean;
  installedAt?: number;
  settings: Record<string, unknown>;
  
  // Runtime state (not persisted)
  _loaded?: boolean;
  _error?: string;
}

/**
 * Plugin Context - passed to plugin functions
 */
export interface PluginContext {
  // App state
  settings: AppSettings;
  pluginSettings: Record<string, unknown>;
  
  // Navigation
  navigate: (view: ViewMode) => void;
  
  // Search results
  showResults: (results: SearchResult[]) => void;
  
  // Electron API
  api: typeof window.electronAPI;
  
  // Plugin utilities
  logger: PluginLogger;
  
  // Update plugin settings
  updateSetting: (key: string, value: unknown) => void;
}

/**
 * Logger for plugins
 */
export interface PluginLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Plugin Command - extends the Command interface
 */
export interface PluginCommand extends Omit<Command, 'handler'> {
  handler: (args: string, ctx: PluginContext) => CommandResult | Promise<CommandResult>;
}

/**
 * Search Provider - allows plugins to add search results
 */
export interface PluginSearchProvider {
  id: string;
  name: string;
  priority: number; // Lower = higher priority
  triggers?: string[]; // Prefix triggers like '/' for commands
  search: (query: string, ctx: PluginContext) => Promise<SearchResult[]> | SearchResult[];
}

/**
 * Plugin Hook - lifecycle and event hooks
 */
export type PluginHookName = 
  | 'onLoad'        // Plugin loaded
  | 'onUnload'      // Plugin unloaded
  | 'onEnable'      // Plugin enabled
  | 'onDisable'     // Plugin disabled
  | 'onSearch'      // Search performed
  | 'onResultOpen'  // Result opened
  | 'onSettingsOpen'; // Settings opened

export interface PluginHookPayloads {
  onLoad: { plugin: Plugin };
  onUnload: { plugin: Plugin };
  onEnable: { plugin: Plugin };
  onDisable: { plugin: Plugin };
  onSearch: { query: string; results: SearchResult[] };
  onResultOpen: { result: SearchResult };
  onSettingsOpen: { category: string };
}

export type PluginHook<T extends PluginHookName> = (
  payload: PluginHookPayloads[T],
  ctx: PluginContext
) => void | Promise<void>;

/**
 * Plugin Definition - what a plugin exports
 */
export interface PluginDefinition {
  // Commands the plugin provides
  commands?: PluginCommand[];
  
  // Search providers
  searchProviders?: PluginSearchProvider[];
  
  // Lifecycle hooks
  hooks?: {
    [K in PluginHookName]?: PluginHook<K>;
  };
  
  // Custom view component (React component name)
  view?: string;
  
  // Settings component (React component name)
  settingsView?: string;
}

/**
 * Plugin API - exposed to plugins
 */
export interface PluginAPI {
  // Get plugin info
  getPlugin: (id: string) => Plugin | null;
  getPluginSettings: (id: string) => Record<string, unknown>;

  // Register commands
  registerCommand: (command: PluginCommand) => void;
  unregisterCommand: (id: string) => void;
  
  // Register search provider
  registerSearchProvider: (provider: PluginSearchProvider) => void;
  unregisterSearchProvider: (id: string) => void;
  
  // Show notification
  showNotification: (message: string, type?: 'info' | 'success' | 'error') => void;
  
  // Execute command
  executeCommand: (commandId: string, args?: string) => Promise<unknown>;
}

/**
 * Plugin Runtime State
 */
export interface PluginRuntime {
  loaded: Map<string, Plugin>;
  commands: Map<string, PluginCommand>;
  searchProviders: Map<string, PluginSearchProvider>;
  hooks: Map<string, Map<PluginHookName, PluginHook<PluginHookName>>>;
}