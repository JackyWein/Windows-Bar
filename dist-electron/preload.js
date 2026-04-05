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
	},
	listDirectory: (path) => electron.ipcRenderer.invoke("list-directory", path),
	getFileIcon: (path) => electron.ipcRenderer.invoke("get-file-icon", path),
	getSystemInfo: () => electron.ipcRenderer.invoke("get-system-info"),
	sleepDisplay: () => electron.ipcRenderer.send("sleep-display"),
	setVolume: (level) => electron.ipcRenderer.send("set-volume", level),
	toggleMute: () => electron.ipcRenderer.send("toggle-mute"),
	emptyTrash: () => electron.ipcRenderer.send("empty-trash"),
	takeScreenshot: () => electron.ipcRenderer.send("take-screenshot"),
	onScreenshotResult: (callback) => {
		electron.ipcRenderer.on("screenshot-result", (_event, result) => callback(result));
	},
	killProcess: (name) => electron.ipcRenderer.invoke("kill-process", name),
	listProcesses: () => electron.ipcRenderer.invoke("list-processes"),
	readClipboard: () => electron.ipcRenderer.invoke("read-clipboard"),
	writeClipboard: (text) => electron.ipcRenderer.send("write-clipboard", text)
});
//#endregion
