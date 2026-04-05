import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openAiChat: () => ipcRenderer.send('open-ai-chat'),
  openUrl: (url: string) => ipcRenderer.send('open-url', url),
  openFile: (path: string) => ipcRenderer.send('open-file', path),
  hideWindow: () => ipcRenderer.send('hide-window'),
  resizeWindow: (w: number, h: number) => ipcRenderer.send('resize-window', w, h),
  searchEverything: (query: string) => ipcRenderer.invoke('search-everything', query),
  fetchInstantAnswer: (query: string) => ipcRenderer.invoke('fetch-instant-answer', query),

  // Native Terminal for Gemini CLI
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
});
