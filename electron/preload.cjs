const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openAiChat: () => ipcRenderer.send('open-ai-chat'),
  openUrl: (url) => ipcRenderer.send('open-url', url),
  openFile: (path) => ipcRenderer.send('open-file', path),
  hideWindow: () => ipcRenderer.send('hide-window'),
  searchEverything: (query) => ipcRenderer.invoke('search-everything', query)
});
