interface AIChatRequest {
  providerType: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cliCommand?: string;
  cliArgs?: string[];
  cliInput?: string;
}

interface ElectronAPI {
  openAiChat: () => void;
  openUrl: (url: string) => void;
  openFile: (path: string) => void;
  hideWindow: () => void;
  resizeWindow: (w: number, h: number) => void;
  searchEverything: (query: string) => Promise<unknown[]>;
  fetchInstantAnswer: (query: string) => Promise<unknown[]>;

  listDirectory: (path: string) => Promise<unknown[]>;
  getFileIcon: (path: string) => Promise<string | null>;

  getSystemInfo: () => Promise<unknown>;
  sleepDisplay: () => void;
  setVolume: (level: number) => void;
  toggleMute: () => void;
  emptyTrash: () => void;
  takeScreenshot: () => void;
  onScreenshotResult: (callback: (result: { success: boolean; path?: string; error?: string }) => void) => void;
  killProcess: (name: string) => Promise<{ success: boolean; error?: string }>;
  listProcesses: () => Promise<{ name: string; pid: string; memory: string }[]>;
  getUptime: () => Promise<{ uptimeSec: number; bootTime: number }>;
  listPorts: () => Promise<{ port: number; pid: string; process: string; address: string }[]>;
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => void;

  // Power & run
  runProgram: (program: string) => Promise<{ success: boolean; error?: string }>;
  lockPC: () => void;
  shutdownPC: () => void;
  restartPC: () => void;
  signOut: () => void;
  setVolumeAbsolute: (level: number) => Promise<{ success: boolean }>;

  // Network & system tools
  getLocalIp: () => Promise<{ ipv4: string[]; ipv6: string[]; hostname: string }>;
  getNetworkInfo: () => Promise<{ ssid?: string; signal?: string; type?: string; profiles?: string[] }>;
  getBattery: () => Promise<{ percent: number; charging: boolean; remaining?: string } | null>;
  pingHost: (host: string) => Promise<{ host: string; avg?: string; loss?: string; output: string }>;
  dnsLookup: (host: string) => Promise<{ host: string; addresses: string[] }>;
  runSpeedtest: () => Promise<{ downloadMbps: number; pingMs: number }>;
  onSpeedtestProgress: (callback: (data: { phase: string; mbps: number; progress: number }) => void) => void;
  removeSpeedtestListeners: () => void;

  // Global hotkey
  setGlobalHotkey: (accelerator: string) => Promise<{ success: boolean; error?: string }>;

  // Window sizing
  setWindowWidth: (width: number) => void;

  // Clipboard history monitor
  startClipboardMonitor: (enabled: boolean) => void;
  getClipboardHistory: () => Promise<{ type: string; value: string; ts: number }[]>;
  clearClipboardHistory: () => Promise<boolean>;
  removeClipboardHistoryItem: (index: number) => Promise<boolean>;
  onClipboardChange: (callback: (history: { type: string; value: string; ts: number }[]) => void) => void;

  // System theme
  getSystemTheme: () => Promise<'light' | 'dark'>;
  onSystemThemeChange: (callback: (theme: 'light' | 'dark') => void) => void;
  removeSystemThemeListeners: () => void;

  // AI Chat
  aiChat: (request: AIChatRequest) => Promise<unknown>;
  aiAbort: () => void;
  onAiChunk: (callback: (chunk: string) => void) => void;
  onAiComplete: (callback: (result: unknown) => void) => void;
  onAiError: (callback: (error: string) => void) => void;
  removeAiListeners: () => void;

  // Credential storage
  storeCredential: (key: string, value: string) => Promise<boolean>;
  getCredential: (key: string) => Promise<string | null>;
  deleteCredential: (key: string) => Promise<boolean>;

  // System Settings
  getSystemSettings: () => Promise<{ autoStart: boolean; alwaysOnTop: boolean; overlayFullscreen: boolean }>;
  updateSystemSettings: (settings: { autoStart?: boolean; alwaysOnTop?: boolean; overlayFullscreen?: boolean }) => void;

  // Updates
  checkForUpdates: () => Promise<{ available: boolean; currentVersion?: string; latestVersion?: string; error?: string; downloaded?: boolean; downloadProgress?: number | null }>;
  installUpdate: () => void;
  getAppVersion: () => Promise<string>;
  onUpdateProgress: (callback: (percent: number) => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;

  // Persistent Data
  readDataSync: (key: string) => string | null;
  writeData: (key: string, data: string) => void;

  // External Commands
  onExternalCommands: (callback: (commands: any[]) => void) => void;
}

interface PluginAPI {
  list: () => Promise<unknown[]>;
  install: (source: string) => Promise<unknown>;
  installDialog: () => Promise<unknown>;
  uninstall: (id: string) => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  getPath: () => Promise<string>;
  reload: (id: string) => Promise<{ success: boolean }>;
  getSettings: (id: string) => Promise<Record<string, unknown>>;
  updateSettings: (id: string, settings: Record<string, unknown>) => Promise<{ success: boolean }>;
  getManifest: (id: string) => Promise<unknown>;
  invokeMainAction: (pluginId: string, action: string, args?: any) => Promise<any>;
  invokeCommand: (pluginId: string, commandId: string, args: string) => Promise<any>;
  invokeSearch: (pluginId: string, providerId: string, query: string) => Promise<any>;
  executeResultAction: (actionId: string) => Promise<any>;

   // Plugin event listeners
   onPluginList: (callback: (plugins: any[]) => void) => void;
   onPluginCommand: (callback: (data: { pluginId: string; command: any }) => void) => void;
   onPluginSearchProvider: (callback: (data: { pluginId: string; provider: any }) => void) => void;
   onPluginResults: (callback: (data: { pluginId: string; results: any[] }) => void) => void;
   onPluginNotification: (callback: (data: { pluginId: string; message: string; type: string }) => void) => void;
   onPluginSettingsUpdated: (callback: (data: { pluginId: string; settings: Record<string, unknown> }) => void) => void;
   onPluginNavigate: (callback: (data: { pluginId: string; view: string }) => void) => void;
   onPluginUnregisterCommands: (callback: (data: { pluginId: string }) => void) => void;
   onPluginReloadCommands: (callback: (data: { pluginId: string }) => void) => void;
   requestCommands: () => Promise<{ success: boolean }>;
   signIn: (pluginId: string) => Promise<{ success: boolean; message?: string }>;
   removePluginSettingsListeners: () => void;
}

interface Window {
  electronAPI: ElectronAPI;
  pluginAPI: PluginAPI;
}
