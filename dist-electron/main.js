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
function getSteamPath() {
	try {
		const match = (0, child_process.execSync)("reg query HKCU\\Software\\Valve\\Steam /v SteamPath").toString().match(/SteamPath\s+REG_SZ\s+(.+)/);
		if (match) return match[1].trim().replace(/\//g, "\\");
	} catch (e) {}
	for (const f of [
		"C:\\Program Files (x86)\\Steam",
		"C:\\Program Files\\Steam",
		"D:\\Steam",
		"E:\\Steam"
	]) try {
		if (require("fs").existsSync(f)) return f;
	} catch (e) {}
	return null;
}
async function scanSteamGames() {
	const steamPath = getSteamPath();
	if (!steamPath) {
		console.log("[WindowsBar] Steam not found.");
		return;
	}
	const libraryRoots = [steamPath];
	try {
		const vdfPath = (0, path.join)(steamPath, "steamapps", "libraryfolders.vdf");
		const pathMatches = (await fs.promises.readFile(vdfPath, "utf-8")).match(/"path"\s+"([^"]+)"/g);
		if (pathMatches) for (const m of pathMatches) {
			const p = m.match(/"path"\s+"([^"]+)"/)?.[1]?.replace(/\\\\/g, "\\");
			if (p && !libraryRoots.includes(p)) libraryRoots.push(p);
		}
	} catch (e) {
		console.log("[WindowsBar] Could not read libraryfolders.vdf");
	}
	console.log(`[WindowsBar] Scanning ${libraryRoots.length} Steam libraries:`, libraryRoots);
	for (const root of libraryRoots) {
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
					if (appId && name && installDir) {
						const gameFolder = (0, path.join)(root, "steamapps", "common", installDir);
						const exePath = await findMainExe(gameFolder);
						indexItems.push({
							title: name,
							path: `steam://rungameid/${appId}`,
							realPath: gameFolder,
							iconPath: exePath || gameFolder,
							type: "game",
							priority: 0
						});
					}
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
				iconPath: exePath || void 0,
				type: exePath ? "game" : "folder",
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
				iconPath: exePath || void 0,
				type: exePath ? "game" : "folder",
				priority: 1
			});
		}
	} catch (e) {}
}
async function scanUserFolders() {
	for (const pf of [
		"desktop",
		"downloads",
		"documents",
		"pictures",
		"videos",
		"music"
	]) try {
		const fullPath = electron.app.getPath(pf);
		indexItems.push({
			title: pf.charAt(0).toUpperCase() + pf.slice(1),
			path: fullPath,
			type: "folder",
			priority: 0
		});
		await crawl(fullPath, "file", 2, 3);
	} catch (e) {}
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
				iconPath: exePath || void 0,
				type: exePath ? "app" : "folder",
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
				if (!SKIP_DIRS.has(nameLower)) {
					indexItems.push({
						title: entry.name,
						path: fullPath,
						type: "folder",
						priority: priority + 1
					});
					await crawl(fullPath, defaultType, priority + 1, maxDepth, depth + 1);
				}
			} else {
				const dotIdx = nameLower.lastIndexOf(".");
				const ext = dotIdx >= 0 ? nameLower.substring(dotIdx) : "";
				if (APP_EXTS.has(ext)) {
					let iconPath;
					if (nameLower.endsWith(".lnk")) try {
						const sh = electron.shell.readShortcutLink(fullPath);
						if (sh.icon && sh.icon.trim()) iconPath = sh.icon;
						else if (sh.target) iconPath = sh.target;
					} catch (e) {}
					else if (nameLower.endsWith(".url")) try {
						const content = require("fs").readFileSync(fullPath, "utf-8");
						const iconMatch = content.match(/IconFile=(.+)/i);
						if (iconMatch?.[1]) {
							let extractedPath = iconMatch[1].trim().replace(/^["']|["']$/g, "");
							if (!extractedPath.match(/^[A-Za-z]:\\/)) {
								const absPath = (0, path.join)(fullPath.substring(0, fullPath.lastIndexOf("\\")), extractedPath);
								try {
									if (require("fs").existsSync(absPath)) extractedPath = absPath;
								} catch (e) {}
							}
							iconPath = extractedPath;
						}
						if (!iconPath) {
							const urlMatch = content.match(/URL=(.+)/i);
							if (urlMatch?.[1]) {
								const steamMatch = urlMatch[1].trim().match(/steam:\/\/rungameid\/(\d+)/i);
								if (steamMatch) {
									const steamPath = getSteamPath();
									if (steamPath) iconPath = (0, path.join)(steamPath, "steam", "games", `${steamMatch[1]}.ico`);
								}
							}
						}
					} catch (e) {}
					else if (nameLower.endsWith(".exe")) iconPath = fullPath;
					if (!iconPath) iconPath = fullPath;
					indexItems.push({
						title: entry.name.replace(/\.(lnk|url)$/i, ""),
						path: fullPath,
						iconPath,
						type: "app",
						priority
					});
				} else if (ALL_EXTS.has(ext)) indexItems.push({
					title: entry.name,
					path: fullPath,
					type: "file",
					priority: priority + 1
				});
			}
		}
	} catch (e) {}
}
function searchIndex(query) {
	const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
	const scored = [];
	const home = (0, os.homedir)().toLowerCase();
	for (const item of indexItems) {
		const titleLower = item.title.toLowerCase();
		if (!terms.every((t) => titleLower.includes(t))) continue;
		let score = 0;
		const pathLower = item.path.toLowerCase();
		if (titleLower === query.toLowerCase()) score += 500;
		else if (titleLower.startsWith(terms[0])) score += 200;
		if (pathLower.startsWith(home)) {
			score += 150;
			for (const uf of [
				"downloads",
				"desktop",
				"documents",
				"pictures",
				"videos",
				"music"
			]) if (pathLower === (0, path.join)(home, uf).toLowerCase()) {
				score += 1e3;
				break;
			}
		}
		if (item.type === "folder") score += 50;
		if (item.type === "game") score += 40;
		if (item.type === "app") score += 30;
		if (item.type === "system") score += 20;
		const depth = item.path.split("\\").length;
		score -= depth * 20;
		score -= (item.priority || 0) * 5;
		score -= item.title.length * .5;
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
	buildIndex();
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
	return searchIndex(query).map((item) => ({
		...item,
		iconBase64: null
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
electron.ipcMain.handle("list-directory", async (_event, dirPath) => {
	try {
		let entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
		if (entries.length === 0) {
			const lowerPath = dirPath.toLowerCase();
			if (lowerPath.includes("downloads") || lowerPath.includes("desktop")) {
				const altPath = lowerPath.includes("downloads") ? (0, path.join)((0, os.homedir)(), "Downloads") : (0, path.join)((0, os.homedir)(), "Desktop");
				if (altPath.toLowerCase() !== lowerPath) try {
					entries = await fs.promises.readdir(altPath, { withFileTypes: true });
				} catch (e) {}
			}
		}
		const visibleResults = entries.filter((e) => !e.name.startsWith(".") && !e.name.startsWith("$"));
		if (visibleResults.length === 0 && entries.length > 0) return [{
			title: "(Nur versteckte/Systemdateien gefunden)",
			path: dirPath,
			type: "file",
			iconBase64: null
		}];
		return visibleResults.slice(0, 30).map((entry) => {
			const name = entry.name;
			const fullPath = (0, path.join)(dirPath, name);
			let type = entry.isDirectory() ? "folder" : "file";
			const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
			if (type === "file" && APP_EXTS.has(ext)) type = "app";
			return {
				title: name,
				path: fullPath,
				type,
				iconBase64: null
			};
		});
	} catch (e) {
		console.error("list-directory error", e);
		return [];
	}
});
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
electron.ipcMain.handle("get-system-info", async () => {
	try {
		const os$1 = require("os");
		const cpus = os$1.cpus();
		const totalMem = os$1.totalmem();
		const freeMem = os$1.freemem();
		const usedMem = totalMem - freeMem;
		const loadAvg = os$1.loadavg();
		let diskInfo = {
			total: 0,
			free: 0
		};
		try {
			const lines = (0, child_process.execSync)("wmic logicaldisk get size,freespace /format:csv", { encoding: "utf-8" }).trim().split("\n").filter((l) => l.trim());
			if (lines.length > 1) {
				const parts = lines[1].split(",");
				if (parts.length >= 2) {
					diskInfo.free = parseInt(parts[0]) || 0;
					diskInfo.total = parseInt(parts[1]) || 0;
				}
			}
		} catch (e) {}
		return {
			cpu: {
				model: cpus[0]?.model || "Unknown",
				cores: cpus.length,
				speed: cpus[0]?.speed || 0,
				loadAvg1: loadAvg[0]?.toFixed(2) || "0",
				loadAvg5: loadAvg[1]?.toFixed(2) || "0",
				loadAvg15: loadAvg[2]?.toFixed(2) || "0"
			},
			memory: {
				total: Math.round(totalMem / (1024 * 1024 * 1024)),
				used: Math.round(usedMem / (1024 * 1024 * 1024)),
				free: Math.round(freeMem / (1024 * 1024 * 1024)),
				usedPercent: Math.round(usedMem / totalMem * 100)
			},
			disk: {
				total: Math.round(diskInfo.total / (1024 * 1024 * 1024)),
				free: Math.round(diskInfo.free / (1024 * 1024 * 1024)),
				usedPercent: diskInfo.total > 0 ? Math.round((diskInfo.total - diskInfo.free) / diskInfo.total * 100) : 0
			}
		};
	} catch (e) {
		console.error("get-system-info error:", e);
		return null;
	}
});
electron.ipcMain.on("sleep-display", () => {
	try {
		(0, child_process.exec)("powershell -command \"(Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{SCROLLLOCK}{SCROLLLOCK}'))\"", (error) => {
			if (error) console.error("Sleep error:", error);
		});
		setTimeout(() => {
			(0, child_process.exec)("powershell -command \"Add-Type -TypeDefinition \\\"using System; using System.Runtime.InteropServices; public class PM { [DllImport(\\\"user32.dll\\\")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam); }\\\"; [PM]::SendMessage(0xFFFF, 0x0112, 0, 2)\"", (e) => {
				if (e) console.error("Monitor off error:", e);
			});
		}, 100);
	} catch (e) {
		console.error("sleep-display error:", e);
	}
});
electron.ipcMain.on("set-volume", (_event, level) => {
	try {
		(0, child_process.exec)(`powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]${Math.max(0, Math.min(100, level))})"`, (error) => {
			if (error) console.error("Volume error:", error);
		});
		(0, child_process.exec)(`powershell -command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`, () => {});
	} catch (e) {
		console.error("set-volume error:", e);
	}
});
electron.ipcMain.on("toggle-mute", () => {
	try {
		(0, child_process.exec)("powershell -command \"(New-Object -ComObject WScript.Shell).SendKeys([char]173)\"", (error) => {
			if (error) console.error("Mute error:", error);
		});
	} catch (e) {
		console.error("toggle-mute error:", e);
	}
});
electron.ipcMain.on("empty-trash", () => {
	try {
		(0, child_process.exec)("powershell -command \"Clear-RecycleBin -Force -ErrorAction SilentlyContinue\"", (error) => {
			if (error) console.error("Empty trash error:", error);
		});
	} catch (e) {
		console.error("empty-trash error:", e);
	}
});
electron.ipcMain.on("take-screenshot", (event) => {
	try {
		const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").substring(0, 19);
		const screenshotPath = (0, path.join)((0, os.homedir)(), "Pictures", `screenshot-${timestamp}.png`);
		(0, child_process.exec)(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Location, [System.Drawing.Point]::Empty, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Size); $bitmap.Save('${screenshotPath}'); $graphics.Dispose(); $bitmap.Dispose()"`, (error) => {
			if (error) {
				console.error("Screenshot error:", error);
				event.reply("screenshot-result", {
					success: false,
					error: error.message
				});
			} else event.reply("screenshot-result", {
				success: true,
				path: screenshotPath
			});
		});
	} catch (e) {
		console.error("take-screenshot error:", e);
		event.reply("screenshot-result", {
			success: false,
			error: String(e)
		});
	}
});
electron.ipcMain.handle("kill-process", async (_event, processName) => {
	try {
		if (!processName || processName.length < 2) return {
			success: false,
			error: "Invalid process name"
		};
		const safeName = processName.replace(/[^a-zA-Z0-9_.-]/g, "");
		if (safeName.length < 2) return {
			success: false,
			error: "Invalid process name after sanitization"
		};
		(0, child_process.exec)(`taskkill /f /im "${safeName}.exe"`, (error, stdout, stderr) => {
			if (error) console.error("Kill process error:", error);
		});
		return {
			success: true,
			message: `Attempting to kill ${safeName}.exe`
		};
	} catch (e) {
		console.error("kill-process error:", e);
		return {
			success: false,
			error: String(e)
		};
	}
});
electron.ipcMain.handle("list-processes", async () => {
	try {
		const lines = (0, child_process.execSync)("tasklist /fo csv /nh", {
			encoding: "utf-8",
			maxBuffer: 1024 * 1024
		}).trim().split("\n");
		const processes = [];
		for (const line of lines.slice(0, 30)) {
			const parts = line.match(/"([^"]+)"/g);
			if (parts && parts.length >= 5) processes.push({
				name: parts[0]?.replace(/"/g, "") || "",
				pid: parts[1]?.replace(/"/g, "") || "",
				memory: parts[4]?.replace(/"/g, "") || ""
			});
		}
		return processes;
	} catch (e) {
		console.error("list-processes error:", e);
		return [];
	}
});
electron.ipcMain.handle("read-clipboard", async () => {
	try {
		return (0, child_process.execSync)("powershell -command \"Get-Clipboard\"", { encoding: "utf-8" }).trim();
	} catch (e) {
		return "";
	}
});
electron.ipcMain.on("write-clipboard", (_event, text) => {
	try {
		(0, child_process.exec)(`powershell -command "Set-Clipboard -Value '${text.replace(/'/g, "''").replace(/\n/g, "`n")}'"`);
	} catch (e) {
		console.error("write-clipboard error:", e);
	}
});
//#endregion
