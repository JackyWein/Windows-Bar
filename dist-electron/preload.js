let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	openAiChat: () => electron.ipcRenderer.send("open-ai-chat"),
	openUrl: (url) => electron.ipcRenderer.send("open-url", url),
	openFile: (path) => electron.ipcRenderer.send("open-file", path),
	hideWindow: () => electron.ipcRenderer.send("hide-window"),
	resizeWindow: (w, h) => electron.ipcRenderer.send("resize-window", w, h),
	searchEverything: (query) => electron.ipcRenderer.invoke("search-everything", query),
	fetchInstantAnswer: (query) => electron.ipcRenderer.invoke("fetch-instant-answer", query),
	startTerminal: () => electron.ipcRenderer.send("start-terminal"),
	stopTerminal: () => electron.ipcRenderer.send("stop-terminal"),
	sendTerminalInput: (data) => electron.ipcRenderer.send("terminal-input", data),
	onTerminalOutput: (callback) => {
		electron.ipcRenderer.on("terminal-output", (_event, data) => callback(data));
	}
});
//#endregion
