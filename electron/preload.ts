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
  }
});
