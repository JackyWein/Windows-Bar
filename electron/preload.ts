import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openAiChat: () => ipcRenderer.send('open-ai-chat'),
  openUrl: (url: string) => ipcRenderer.send('open-url', url),
  openFile: (path: string) => ipcRenderer.send('open-file', path),
  hideWindow: () => ipcRenderer.send('hide-window'),
  resizeWindow: (w: number, h: number) => ipcRenderer.send('resize-window', w, h),
  searchEverything: (query: string) => ipcRenderer.invoke('search-everything', query),
  fetchInstantAnswer: (query: string) => ipcRenderer.invoke('fetch-instant-answer', query),

  // Legacy terminal (kept for backward compat, will be removed)
  startTerminal: () => ipcRenderer.send('start-terminal'),
  stopTerminal: () => ipcRenderer.send('stop-terminal'),
  sendTerminalInput: (data: string) => ipcRenderer.send('terminal-input', data),
  onTerminalOutput: (callback: (data: string) => void) => {
    ipcRenderer.on('terminal-output', (_event, data) => callback(data));
  },
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
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  writeClipboard: (text: string) => ipcRenderer.send('write-clipboard', text),

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
  onUpdateProgress: (callback: (percent: number) => void) => 
    ipcRenderer.on('update-progress', (_event, percent) => callback(percent)),
  onUpdateDownloaded: (callback: () => void) => 
    ipcRenderer.on('update-downloaded', () => callback()),

  // Persistent Data
  readDataSync: (key: string) => ipcRenderer.sendSync('read-data-sync', key),
  writeData: (key: string, data: string) => ipcRenderer.send('write-data', key, data),
});

// Plugin API bridge
contextBridge.exposeInMainWorld('pluginAPI', {
  list: () => ipcRenderer.invoke('plugin:list'),
  install: (source: string) => ipcRenderer.invoke('plugin:install', source),
  uninstall: (id: string) => ipcRenderer.invoke('plugin:uninstall', id),
  toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('plugin:toggle', id, enabled),
  getPath: () => ipcRenderer.invoke('plugin:get-path'),
});
