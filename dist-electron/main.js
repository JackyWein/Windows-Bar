let electron = require("electron");
let path = require("path");
let fs = require("fs");
let os = require("os");
let child_process = require("child_process");
//#region electron/main.ts
var indexItems = [];
var APP_EXTS = new Set([
	".exe",
	".lnk",
	".url",
	".msi",
	".bat",
	".cmd",
	".ps1"
]);
var DOC_EXTS = new Set([
	".pdf",
	".docx",
	".doc",
	".xlsx",
	".xls",
	".pptx",
	".ppt",
	".txt",
	".md",
	".csv",
	".json",
	".xml",
	".html",
	".htm"
]);
var MEDIA_EXTS = new Set([
	".jpg",
	".jpeg",
	".png",
	".gif",
	".mp4",
	".mkv",
	".avi",
	".mp3",
	".wav",
	".flac",
	".zip",
	".rar",
	".7z"
]);
var ALL_EXTS = new Set([
	...APP_EXTS,
	...DOC_EXTS,
	...MEDIA_EXTS
]);
var SKIP_DIRS = new Set([
	"node_modules",
	".git",
	"__pycache__",
	".vscode",
	".idea",
	"dist",
	"$recycle.bin",
	"$windows.~bt",
	"$windows.~ws",
	"windows",
	"system volume information",
	"recovery",
	"msocache",
	"perflogs",
	"config.msi",
	"intel",
	"amd",
	"nvidia",
	"programdata",
	"appdata"
]);
var SKIP_EXES = new Set([
	"unins000.exe",
	"uninstall.exe",
	"unitycrashandler64.exe",
	"unitycrashandler32.exe",
	"crashreporter.exe",
	"crashpad_handler.exe",
	"ue4prereqsetup_x64.exe",
	"dxsetup.exe",
	"vcredist_x64.exe",
	"vcredist_x86.exe",
	"dotnetfx35setup.exe"
]);
async function buildIndex() {
	const start = Date.now();
	console.log("[WindowsBar] Building index...");
	await scanStartMenu();
	await scanSteamGames();
	await scanEpicGames();
	await scanRiotGames();
	await scanUserFolders();
	await scanProgramFiles();
	await scanAllDrives();
	injectSystemTools();
	const seen = /* @__PURE__ */ new Map();
	indexItems = indexItems.filter((item) => {
		const key = item.path.toLowerCase();
		if (seen.has(key)) return false;
		seen.set(key, true);
		return true;
	});
	console.log(`[WindowsBar] Index ready: ${indexItems.length} items in ${Date.now() - start}ms`);
}
function injectSystemTools() {
	indexItems.push(...[
		{
			title: "Einstellungen",
			path: "ms-settings:",
			type: "system",
			priority: -5
		},
		{
			title: "Systemsteuerung",
			path: "control",
			type: "system",
			priority: -5
		},
		{
			title: "Registrierungs-Editor (Regedit)",
			path: "regedit",
			type: "system",
			priority: -5
		},
		{
			title: "Task-Manager",
			path: "taskmgr",
			type: "system",
			priority: -5
		},
		{
			title: "Datei-Explorer",
			path: "explorer",
			type: "system",
			priority: -5
		},
		{
			title: "Rechner",
			path: "calc",
			type: "system",
			priority: -5
		},
		{
			title: "Editor (Notepad)",
			path: "notepad",
			type: "system",
			priority: -5
		},
		{
			title: "Eingabeaufforderung (CMD)",
			path: "cmd",
			type: "system",
			priority: -5
		},
		{
			title: "PowerShell",
			path: "powershell",
			type: "system",
			priority: -5
		},
		{
			title: "Geräte-Manager",
			path: "devmgmt.msc",
			type: "system",
			priority: -5
		}
	]);
}
async function scanStartMenu() {
	const paths = [(0, path.join)(process.env.ProgramData || "C:\\ProgramData", "Microsoft\\Windows\\Start Menu\\Programs"), (0, path.join)((0, os.homedir)(), "AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs")];
	for (const p of paths) await crawl(p, "app", 0, 10);
}
async function scanSteamGames() {
	const steamRoots = [
		"C:\\Program Files (x86)\\Steam",
		"C:\\Program Files\\Steam",
		"D:\\Steam",
		"D:\\SteamLibrary",
		"E:\\Steam",
		"E:\\SteamLibrary",
		"F:\\Steam",
		"F:\\SteamLibrary",
		"G:\\Steam",
		"G:\\SteamLibrary"
	];
	try {
		const pathMatches = (await fs.promises.readFile("C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf", "utf-8")).match(/"path"\s+"([^"]+)"/g);
		if (pathMatches) for (const m of pathMatches) {
			const p = m.match(/"path"\s+"([^"]+)"/)?.[1]?.replace(/\\\\/g, "\\");
			if (p && !steamRoots.includes(p)) steamRoots.push(p);
		}
	} catch (e) {}
	for (const root of steamRoots) {
		const appsDir = (0, path.join)(root, "steamapps");
		try {
			const files = await fs.promises.readdir(appsDir);
			for (const f of files) {
				if (!f.startsWith("appmanifest_") || !f.endsWith(".acf")) continue;
				try {
					const content = await fs.promises.readFile((0, path.join)(appsDir, f), "utf-8");
					const appId = content.match(/"appid"\s+"(\d+)"/)?.[1];
					const name = content.match(/"name"\s+"([^"]+)"/)?.[1];
					const installDir = content.match(/"installdir"\s+"([^"]+)"/)?.[1];
					if (appId && name && installDir) indexItems.push({
						title: name,
						path: `steam://rungameid/${appId}`,
						type: "game",
						priority: 0
					});
				} catch (e) {}
			}
		} catch (e) {}
	}
}
async function scanEpicGames() {
	for (const ep of [
		"C:\\Program Files\\Epic Games",
		"D:\\Epic Games",
		"E:\\Epic Games",
		"F:\\Epic Games"
	]) try {
		const entries = await fs.promises.readdir(ep, { withFileTypes: true });
		for (const entry of entries) if (entry.isDirectory() && entry.name !== "Launcher") {
			const exePath = await findMainExe((0, path.join)(ep, entry.name));
			indexItems.push({
				title: entry.name,
				path: exePath || (0, path.join)(ep, entry.name),
				type: "game",
				priority: 1
			});
		}
	} catch (e) {}
}
async function scanRiotGames() {
	for (const rp of ["C:\\Riot Games", "D:\\Riot Games"]) try {
		const entries = await fs.promises.readdir(rp, { withFileTypes: true });
		for (const entry of entries) if (entry.isDirectory()) {
			const exePath = await findMainExe((0, path.join)(rp, entry.name));
			indexItems.push({
				title: entry.name,
				path: exePath || (0, path.join)(rp, entry.name),
				type: "game",
				priority: 1
			});
		}
	} catch (e) {}
}
async function scanUserFolders() {
	const home = (0, os.homedir)();
	for (const folder of [
		"Desktop",
		"Downloads",
		"Documents",
		"Pictures",
		"Videos",
		"Music"
	]) await crawl((0, path.join)(home, folder), "file", 2, 3);
}
async function scanProgramFiles() {
	for (const dir of [
		"C:\\Program Files",
		"C:\\Program Files (x86)",
		"D:\\Program Files"
	]) try {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true });
		for (const entry of entries) if (entry.isDirectory()) {
			const exePath = await findMainExe((0, path.join)(dir, entry.name));
			indexItems.push({
				title: entry.name,
				path: exePath || (0, path.join)(dir, entry.name),
				type: "app",
				priority: 3
			});
		}
	} catch (e) {}
}
async function scanAllDrives() {
	for (const letter of [
		"C",
		"D",
		"E",
		"F",
		"G",
		"H"
	]) {
		const root = `${letter}:\\`;
		try {
			await fs.promises.access(root);
			const entries = await fs.promises.readdir(root, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
				if ([
					"Program Files",
					"Program Files (x86)",
					"Users",
					"ProgramData"
				].includes(entry.name)) continue;
				await crawl((0, path.join)(root, entry.name), "file", 5, 2);
			}
		} catch (e) {}
	}
}
async function findMainExe(dir) {
	try {
		const exes = (await fs.promises.readdir(dir, { withFileTypes: true })).filter((e) => !e.isDirectory() && e.name.toLowerCase().endsWith(".exe")).filter((e) => !SKIP_EXES.has(e.name.toLowerCase())).map((e) => e.name);
		if (exes.length === 0) return null;
		if (exes.length === 1) return (0, path.join)(dir, exes[0]);
		const folderName = dir.split("\\").pop()?.toLowerCase() || "";
		const match = exes.find((e) => e.toLowerCase().replace(".exe", "").includes(folderName));
		if (match) return (0, path.join)(dir, match);
		let largest = {
			name: exes[0],
			size: 0
		};
		for (const exe of exes) try {
			const stat = await fs.promises.stat((0, path.join)(dir, exe));
			if (stat.size > largest.size) largest = {
				name: exe,
				size: stat.size
			};
		} catch (e) {}
		return (0, path.join)(dir, largest.name);
	} catch (e) {
		return null;
	}
}
async function crawl(dir, defaultType, priority, maxDepth, depth = 0) {
	if (depth > maxDepth) return;
	try {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = (0, path.join)(dir, entry.name);
			const nameLower = entry.name.toLowerCase();
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(nameLower)) await crawl(fullPath, defaultType, priority + 1, maxDepth, depth + 1);
			} else {
				const dotIdx = nameLower.lastIndexOf(".");
				const ext = dotIdx >= 0 ? nameLower.substring(dotIdx) : "";
				if (APP_EXTS.has(ext)) indexItems.push({
					title: entry.name.replace(/\.(lnk|url)$/i, ""),
					path: fullPath,
					type: "app",
					priority
				});
				else if (ALL_EXTS.has(ext)) indexItems.push({
					title: entry.name,
					path: fullPath,
					type: "file",
					priority: priority + 1
				});
			}
		}
	} catch (e) {}
}
buildIndex();
function searchIndex(query) {
	const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
	const scored = [];
	for (const item of indexItems) {
		const titleLower = item.title.toLowerCase();
		if (!terms.every((t) => titleLower.includes(t))) continue;
		let score = 0;
		if (titleLower === query.toLowerCase()) score += 100;
		if (titleLower.startsWith(terms[0])) score += 50;
		if (item.type === "system") score += 30;
		if (item.type === "game") score += 25;
		if (item.type === "app") score += 20;
		score -= item.priority * 2;
		score -= item.title.length * .1;
		scored.push({
			item,
			score
		});
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, 15).map((s) => s.item);
}
var mainWindow = null;
var isDev = !electron.app.isPackaged;
function createWindow() {
	mainWindow = new electron.BrowserWindow({
		width: 750,
		height: 600,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		resizable: false,
		show: false,
		webPreferences: {
			preload: (0, path.join)(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: false,
			webviewTag: true
		}
	});
	if (isDev && process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile((0, path.join)(__dirname, "../dist/index.html"));
	mainWindow.on("blur", () => {
		if (mainWindow?.webContents.isDevToolsOpened()) return;
		mainWindow?.hide();
	});
	mainWindow.on("ready-to-show", () => {
		if (isDev) mainWindow?.show();
	});
}
function toggleWindow() {
	if (mainWindow?.isVisible()) mainWindow.hide();
	else {
		mainWindow?.show();
		mainWindow?.focus();
	}
}
electron.app.whenReady().then(() => {
	createWindow();
	const success = electron.globalShortcut.register("Alt+Space", toggleWindow);
	console.log(success ? "[WindowsBar] Alt+Space registered" : "[WindowsBar] Shortcut FAILED");
	electron.app.setLoginItemSettings({
		openAtLogin: true,
		path: electron.app.getPath("exe")
	});
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("will-quit", () => electron.globalShortcut.unregisterAll());
electron.app.on("window-all-closed", () => {});
electron.ipcMain.handle("search-everything", async (_event, query) => {
	if (!query?.trim()) return [];
	const top15 = searchIndex(query);
	return await Promise.all(top15.map(async (item) => {
		let iconBase64 = null;
		if ([
			"app",
			"game",
			"system"
		].includes(item.type) && item.path && !item.path.startsWith("steam://")) try {
			const img = await electron.app.getFileIcon(item.path, { size: "normal" });
			if (!img.isEmpty()) iconBase64 = img.toDataURL();
		} catch (e) {}
		return {
			...item,
			iconBase64
		};
	}));
});
electron.ipcMain.handle("fetch-instant-answer", async (_event, query) => {
	const results = [];
	const trimQuery = query.trim();
	try {
		if (/^[0-9+\-*/().\s]{3,}$/.test(trimQuery)) {
			const res = new Function(`return (${trimQuery})`)();
			if (res !== void 0 && !isNaN(res)) results.push({
				title: `${res}`,
				subtitle: `Ergebnis von ${trimQuery}`,
				type: "calc",
				path: `${res}`,
				isWeb: true
			});
		}
	} catch (e) {}
	if (trimQuery.toLowerCase().startsWith("wetter")) try {
		const city = trimQuery.substring(6).trim() || "";
		const wRes = await electron.net.fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%t|%C|%w&lang=de`);
		if (wRes.ok) {
			const text = await wRes.text();
			const parts = text.split("|");
			if (parts.length >= 2 && !text.includes("Unknown")) results.push({
				title: `Wetter ${city ? city : "Aktuell"}`,
				subtitle: `${parts[0].trim()}, ${parts[1].trim()} (Wind: ${parts[2]?.trim() || ""})`,
				type: "weather",
				path: `https://www.google.com/search?q=wetter+${encodeURIComponent(city)}`,
				isWeb: true
			});
		}
	} catch (e) {}
	try {
		const dRes = await electron.net.fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(trimQuery)}&format=json&no_html=1&skip_disambig=1&kad=de_DE`);
		if (dRes.ok) {
			const dJson = await dRes.json();
			if (dJson.AbstractText) results.push({
				title: dJson.Heading || trimQuery,
				subtitle: dJson.AbstractText,
				type: "web",
				path: dJson.AbstractURL || `https://www.google.com/search?q=${encodeURIComponent(trimQuery)}`,
				isWeb: true
			});
		}
	} catch (e) {}
	try {
		const sRes = await electron.net.fetch(`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(trimQuery)}`);
		if (sRes.ok) {
			const suggestions = (await sRes.json())[1] || [];
			for (const s of suggestions.slice(0, 4)) {
				if (results.some((r) => r.title.toLowerCase() === s.toLowerCase())) continue;
				results.push({
					title: `"${s}" suchen`,
					subtitle: "Google Suche im Browser",
					type: "web",
					path: `https://www.google.com/search?q=${encodeURIComponent(s)}`,
					isWeb: true
				});
			}
		}
	} catch (e) {}
	if (results.length === 0) results.push({
		title: `Nach "${trimQuery}" suchen`,
		subtitle: "Google Suche im Browser öffnen",
		type: "web",
		path: `https://www.google.com/search?q=${encodeURIComponent(trimQuery)}`,
		isWeb: true
	});
	return results;
});
electron.ipcMain.on("hide-window", () => mainWindow?.hide());
electron.ipcMain.on("open-url", (_event, url) => {
	electron.shell.openExternal(url);
	mainWindow?.hide();
});
electron.ipcMain.on("open-file", (_event, filePath) => {
	if (filePath.startsWith("steam://")) electron.shell.openExternal(filePath);
	else electron.shell.openPath(filePath);
	mainWindow?.hide();
});
electron.ipcMain.on("resize-window", (_event, width, height) => {
	if (mainWindow) {
		mainWindow.setSize(width, height, true);
		mainWindow.center();
	}
});
var termProc = null;
electron.ipcMain.on("start-terminal", (event) => {
	if (termProc) try {
		termProc.kill();
	} catch (e) {}
	termProc = (0, child_process.spawn)("cmd.exe", [], {
		cwd: (0, os.homedir)(),
		env: process.env
	});
	termProc.stdout?.on("data", (data) => {
		event.reply("terminal-output", data.toString());
	});
	termProc.stderr?.on("data", (data) => {
		event.reply("terminal-output", data.toString());
	});
	termProc.on("close", () => {
		event.reply("terminal-output", "\r\n[Process exited]\r\n");
	});
	setTimeout(() => {
		if (termProc && termProc.stdin) termProc.stdin.write("gemini\r\n");
	}, 600);
});
electron.ipcMain.on("terminal-input", (_event, data) => {
	if (termProc && termProc.stdin) termProc.stdin.write(data);
});
electron.ipcMain.on("stop-terminal", () => {
	if (termProc) {
		try {
			termProc.kill();
		} catch (e) {}
		termProc = null;
	}
});
//#endregion
