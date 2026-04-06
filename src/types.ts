// ========================
// Shared Types
// ========================

import type { AISettings } from "./core/ai/types";

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'app' | 'file' | 'game' | 'ai' | 'web' | 'system' | 'weather' | 'calc' | 'folder';
  path?: string;
  isWeb?: boolean;
  iconBase64?: string;
  iconPath?: string;
  isExpandBtn?: boolean;
  isSubItem?: boolean;
  isRecent?: boolean;
  isHelpCategory?: boolean;
  helpCommands?: string;
  copyToClipboard?: string;
  folderDepth?: number;
}

export type ViewMode = 'search' | 'ai' | 'settings';

// ========================
// Theme System
// ========================

export interface ThemeColors {
  bg: string;
  bgAlpha: number;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  app: string;
  game: string;
  file: string;
  web: string;
  system: string;
}

export interface Theme {
  id: string;
  name: string;
  type: 'light' | 'dark' | 'custom';
  colors: ThemeColors;
  blur: {
    enabled: boolean;
    amount: number;
  };
  radius: number;
  fontSize: number;
  fontFamily: string;
}

// ========================
// Command System
// ========================

export interface Command {
  id: string;
  trigger: string | RegExp;
  description: string;
  usage?: string;
  category: 'calc' | 'web' | 'system' | 'text' | 'notes' | 'power' | 'clipboard';
  handler: (args: string, ctx: CommandContext) => CommandResult | Promise<CommandResult>;
  enabled: boolean;
  aliases?: readonly string[];
  requiresSetting?: string;
}

export interface CommandContext {
  settings: AppSettings;
  query: string;
  showResults: (results: SearchResult[]) => void;
  navigate: (view: ViewMode) => void;
  api: typeof window.electronAPI;
}

export interface CommandResult {
  results: SearchResult[];
  copyToClipboard?: string;
  navigate?: ViewMode;
}

// ========================
// Plugin System
// ========================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  commands?: string[];
  settings?: string[];
  minAppVersion?: string;
  // Plugin UI capabilities
  ui?: {
    // Support for compact mode - plugin can render differently when compact
    supportsCompactMode?: boolean;
    // Height in normal mode (pixels)
    normalHeight?: number;
    // Height in compact mode (pixels)
    compactHeight?: number;
    // Whether plugin wants to use theme colors
    useThemeColors?: boolean;
    // Icon badge support for compact mode
    compactBadge?: boolean;
  };
  // Plugin hooks - functions that get called by the app
  hooks?: {
    // Called when compact mode changes
    onCompactModeChange?: boolean;
    // Called when theme changes
    onThemeChange?: boolean;
    // Called when accent color changes
    onAccentColorChange?: boolean;
    // Called when settings change
    onSettingsChange?: boolean;
  };
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  installed: boolean;
}

// Plugin context passed to plugin render functions
export interface PluginContext {
  isCompactMode: boolean;
  theme: {
    colors: ThemeColors;
    accentColor: string;
    borderRadius: number;
  };
  settings: AppSettings;
  api: typeof window.electronAPI;
}

// Plugin render result for UI components
export interface PluginRenderResult {
  // Main content to render
  content: React.ReactNode;
  // Optional badge content for compact mode
  badge?: React.ReactNode;
  // Height override
  height?: number;
}

// ========================
// Keyboard Shortcuts
// ========================

export type ShortcutCategory = 'global' | 'search' | 'results' | 'navigation';

export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  defaultBinding: string;
  category: ShortcutCategory;
}

// ========================
// Settings
// ========================

export interface AppSettings {
  appearance: {
    theme: string;
    accentColor: string;
    fontSize: number; // Font size in pixels (10-24)
    fontFamily: string;
    animations: boolean;
    blur: { enabled: boolean; amount: number };
    transparency: number;
    borderRadius: number;
    windowWidth: number;
    windowHeight: number;
    showScrollbar: boolean;
    compactMode: boolean;
  };
  system: {
    autoStart: boolean;
    alwaysOnTop: boolean;
    overlayFullscreen: boolean;
  };
  search: {
    maxResults: number;
    showWebSuggestions: boolean;
    defaultCity: string;
    searchDelay: number;
    showRecents: boolean;
    recentCount: number;
  };
  commands: {
    enabled: Record<string, boolean>;
  };
  shortcuts: Record<string, string>;
  features: {
    weatherEnabled: boolean;
    aiEnabled: boolean;
    clipboardHistory: boolean;
    notesEnabled: boolean;
  };
  privacy: {
    saveRecents: boolean;
    saveClipboardHistory: boolean;
  };
  plugins: {
    enabled: Record<string, boolean>;
  };
  ai: AISettings;
}

export const defaultSettings: AppSettings = {
  appearance: {
    theme: 'dark-default',
    accentColor: '#7c5cfc',
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
    animations: true,
    blur: { enabled: true, amount: 40 },
    transparency: 85,
    borderRadius: 14,
    windowWidth: 680,
    windowHeight: 600,
    showScrollbar: true,
    compactMode: false,
  },
  system: {
    autoStart: true,
    alwaysOnTop: true,
    overlayFullscreen: false,
  },
  search: {
    maxResults: 20,
    showWebSuggestions: true,
    defaultCity: 'Berlin',
    searchDelay: 100,
    showRecents: true,
    recentCount: 5,
  },
  commands: {
    enabled: {},
  },
  shortcuts: {},
  features: {
    weatherEnabled: true,
    aiEnabled: true,
    clipboardHistory: true,
    notesEnabled: true,
  },
  privacy: {
    saveRecents: true,
    saveClipboardHistory: true,
  },
  plugins: {
    enabled: {},
  },
  ai: {
    defaultProvider: null,
    defaultModel: null,
    setupComplete: false,
    providers: {},
  },
};
