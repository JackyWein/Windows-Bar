import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openAiChat: () => ipcRenderer.send('open-ai-chat'),
  openUrl: (url: string) => ipcRenderer.send('open-url', url),
  openFile: (path: string) => ipcRenderer.send('open-file', path),
  hideWindow: () => ipcRenderer.send('hide-window'),
  resizeWindow: (w: number, h: number) => ipcRenderer.send('resize-window', w, h),
  searchEverything: (query: string) => ipcRenderer.invoke('search-everything', query),
  fetchInstantAnswer: (query: string) => ipcRenderer.invoke('fetch-instant-answer', query),

  listDirectory: (path: string) => ipcRenderer.invoke('list-directory', path),
  getFileIcon: (path: string) => ipcRenderer.invoke('get-file-icon', path),

  // System Functions
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  sleepDisplay: () => ipcRenderer.send('sleep-display'),
  setVolume: (level: number) => ipcRenderer.send('set-volume', level),
  toggleMute: () => ipcRenderer.send('toggle-mute'),
  emptyTrash: () => ipcRenderer.send('empty-trash'),
  takeScreenshot: () => ipcRenderer.send('take-screenshot'),
  onScreenshotResult: (callback: (result: { success: boolean; path?: string; error?: string }) => void) => {
    ipcRenderer.on('screenshot-result', (_event, result) => callback(result));
  },
  killProcess: (name: string) => ipcRenderer.invoke('kill-process', name),
  listProcesses: () => ipcRenderer.invoke('list-processes'),
  getUptime: () => ipcRenderer.invoke('get-uptime'),
  listPorts: () => ipcRenderer.invoke('list-ports'),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  writeClipboard: (text: string) => ipcRenderer.send('write-clipboard', text),

  // Power & run
  runProgram: (program: string) => ipcRenderer.invoke('run-program', program),
  lockPC: () => ipcRenderer.send('power-action', 'lock'),
  shutdownPC: () => ipcRenderer.send('power-action', 'shutdown'),
  restartPC: () => ipcRenderer.send('power-action', 'restart'),
  signOut: () => ipcRenderer.send('power-action', 'logoff'),
  setVolumeAbsolute: (level: number) => ipcRenderer.invoke('set-volume-absolute', level),

  // Network & system tools
  getLocalIp: () => ipcRenderer.invoke('get-local-ip'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getBattery: () => ipcRenderer.invoke('get-battery'),
  pingHost: (host: string) => ipcRenderer.invoke('ping-host', host),
  dnsLookup: (host: string) => ipcRenderer.invoke('dns-lookup', host),
  runSpeedtest: () => ipcRenderer.invoke('run-speedtest'),
  onSpeedtestProgress: (callback: (data: { phase: string; mbps: number; progress: number }) => void) => {
    ipcRenderer.on('speedtest-progress', (_event, data) => callback(data));
  },
  removeSpeedtestListeners: () => ipcRenderer.removeAllListeners('speedtest-progress'),

  // Global hotkey (customizable)
  setGlobalHotkey: (accelerator: string) => ipcRenderer.invoke('set-global-hotkey', accelerator),

  // Window sizing
  setWindowWidth: (width: number) => ipcRenderer.send('set-window-width', width),

  // Clipboard history monitor
  startClipboardMonitor: (enabled: boolean) => ipcRenderer.send('clipboard-monitor', enabled),
  getClipboardHistory: () => ipcRenderer.invoke('clipboard-history-get'),
  clearClipboardHistory: () => ipcRenderer.invoke('clipboard-history-clear'),
  removeClipboardHistoryItem: (index: number) => ipcRenderer.invoke('clipboard-history-remove', index),
  onClipboardChange: (callback: (history: { type: string; value: string; ts: number }[]) => void) => {
    ipcRenderer.on('clipboard-changed', (_event, history) => callback(history));
  },

  // System theme (light/dark) for autoTheme
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onSystemThemeChange: (callback: (theme: 'light' | 'dark') => void) => {
    ipcRenderer.on('system-theme-changed', (_event, theme) => callback(theme));
  },
  removeSystemThemeListeners: () => ipcRenderer.removeAllListeners('system-theme-changed'),

  // AI Chat
  aiChat: (request: unknown) => ipcRenderer.invoke('ai:chat', request),
  aiAbort: () => ipcRenderer.send('ai:abort'),
  onAiChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('ai:chunk', (_event, chunk) => callback(chunk));
  },
  onAiComplete: (callback: (result: unknown) => void) => {
    ipcRenderer.on('ai:complete', (_event, result) => callback(result));
  },
  onAiError: (callback: (error: string) => void) => {
    ipcRenderer.on('ai:error', (_event, error) => callback(error));
  },
  removeAiListeners: () => {
    ipcRenderer.removeAllListeners('ai:chunk');
    ipcRenderer.removeAllListeners('ai:complete');
    ipcRenderer.removeAllListeners('ai:error');
  },

  // Credential storage (encrypted via OS keychain)
  storeCredential: (key: string, value: string) => ipcRenderer.invoke('store-credential', key, value),
  getCredential: (key: string) => ipcRenderer.invoke('get-credential', key),
  deleteCredential: (key: string) => ipcRenderer.invoke('delete-credential', key),

  // System Settings
  getSystemSettings: () => ipcRenderer.invoke('get-system-settings'),
  updateSystemSettings: (settings: { autoStart?: boolean; alwaysOnTop?: boolean; overlayFullscreen?: boolean }) =>
    ipcRenderer.send('update-system-settings', settings),

  // Update Check
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateProgress: (callback: (percent: number) => void) => ipcRenderer.on('update-progress', (_event, percent) => callback(percent)),
  onUpdateDownloaded: (callback: () => void) => ipcRenderer.on('update-downloaded', () => callback()),
  onUpdateReady: (callback: () => void) => ipcRenderer.on('update-ready', () => callback()),
});

// Plugin API bridge
contextBridge.exposeInMainWorld('pluginAPI', {
  // Basic lifecycle
  list: () => ipcRenderer.invoke('plugin:list'),
  install: (source: string) => ipcRenderer.invoke('plugin:install', source),
  installDialog: () => ipcRenderer.invoke('plugin:install-dialog'),
  uninstall: (id: string) => ipcRenderer.invoke('plugin:uninstall', id),
  toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('plugin:toggle', id, enabled),
  getPath: () => ipcRenderer.invoke('plugin:get-path'),
  reload: (id: string) => ipcRenderer.invoke('plugin:reload', id),

  // Settings
  getSettings: (id: string) => ipcRenderer.invoke('plugin:get-settings', id),
  updateSettings: (id: string, settings: Record<string, unknown>) =>
    ipcRenderer.invoke('plugin:update-settings', id, settings),
  getManifest: (id: string) => ipcRenderer.invoke('plugin:get-manifest', id),

  // Main process actions (e.g., player methods)
  invokeMainAction: (pluginId: string, action: string, args?: any) => ipcRenderer.invoke('plugin:invoke-action', pluginId, action, args),
  invokeCommand: (pluginId: string, commandId: string, args: string) => ipcRenderer.invoke('plugin:invoke-command', pluginId, commandId, args),
  invokeSearch: (pluginId: string, providerId: string, query: string) => ipcRenderer.invoke('plugin:invoke-search', pluginId, providerId, query),
  executeResultAction: (actionId: string) => ipcRenderer.invoke('plugin:execute-result-action', actionId),
  signIn: (pluginId: string) => ipcRenderer.invoke('plugin:sign-in', pluginId),

  // Event listeners for plugin events
  onPluginList: (callback: (plugins: unknown[]) => void) => {
    ipcRenderer.on('plugin:list', (_event, plugins) => callback(plugins));
  },
  onPluginCommand: (callback: (data: { pluginId: string; command: unknown }) => void) => {
    ipcRenderer.on('plugin:command', (_event, data) => callback(data));
  },
  onPluginSearchProvider: (callback: (data: { pluginId: string; provider: unknown }) => void) => {
    ipcRenderer.on('plugin:search-provider', (_event, data) => callback(data));
  },
  onPluginResults: (callback: (data: { pluginId: string; results: unknown[] }) => void) => {
    ipcRenderer.on('plugin:results', (_event, data) => callback(data));
  },
  onPluginNotification: (callback: (data: { pluginId: string; message: string; type: string }) => void) => {
    ipcRenderer.on('plugin:notification', (_event, data) => callback(data));
  },
  onPluginSettingsUpdated: (callback: (data: { pluginId: string; settings: Record<string, unknown> }) => void) => {
    ipcRenderer.on('plugin:settings-updated', (_event, data) => callback(data));
  },
  removePluginSettingsListeners: () => ipcRenderer.removeAllListeners('plugin:settings-updated'),
  onPluginNavigate: (callback: (data: { pluginId: string; view: string }) => void) => {
    ipcRenderer.on('plugin:navigate', (_event, data) => callback(data));
  },
  onPluginUnregisterCommands: (callback: (data: { pluginId: string }) => void) => {
    ipcRenderer.on('plugin:unregister-commands', (_event, data) => callback(data));
  },
  onPluginReloadCommands: (callback: (data: { pluginId: string }) => void) => {
    ipcRenderer.on('plugin:reload-commands', (_event, data) => callback(data));
  },
  requestCommands: () => ipcRenderer.invoke('plugin:request-commands'),
});