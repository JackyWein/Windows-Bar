import { app, BrowserWindow, globalShortcut, ipcMain, shell, net } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { spawn, ChildProcess } from 'child_process';

// ========================
// CUSTOM FAST INDEXER
// ========================

interface IndexItem {
  title: string;
  path: string;       // file path or steam:// URL
  type: 'app' | 'file' | 'game' | 'system';
  priority: number;
}

let indexItems: IndexItem[] = [];

const APP_EXTS = new Set(['.exe', '.lnk', '.url', '.msi', '.bat', '.cmd', '.ps1']);
const DOC_EXTS = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm']);
const MEDIA_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mkv', '.avi', '.mp3', '.wav', '.flac', '.zip', '.rar', '.7z']);
const ALL_EXTS = new Set([...APP_EXTS, ...DOC_EXTS, ...MEDIA_EXTS]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.vscode', '.idea', 'dist',
  '$recycle.bin', '$windows.~bt', '$windows.~ws', 'windows',
  'system volume information', 'recovery', 'msocache',
  'perflogs', 'config.msi', 'intel', 'amd', 'nvidia',
  'programdata', 'appdata',
]);

const SKIP_EXES = new Set([
  'unins000.exe', 'uninstall.exe', 'unitycrashandler64.exe', 'unitycrashandler32.exe',
  'crashreporter.exe', 'crashpad_handler.exe', 'ue4prereqsetup_x64.exe',
  'dxsetup.exe', 'vcredist_x64.exe', 'vcredist_x86.exe', 'dotnetfx35setup.exe',
]);

async function buildIndex() {
  const start = Date.now();
  console.log('[WindowsBar] Building index...');

  await scanStartMenu();
  await scanSteamGames();
  await scanEpicGames();
  await scanRiotGames();
  await scanUserFolders();
  await scanProgramFiles();
  await scanAllDrives();
  injectSystemTools();

  // Deduplicate by path
  const seen = new Map<string, boolean>();
  indexItems = indexItems.filter(item => {
    const key = item.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });

  console.log(`[WindowsBar] Index ready: ${indexItems.length} items in ${Date.now() - start}ms`);
}

function injectSystemTools() {
  const tools = [
    { title: 'Einstellungen', path: 'ms-settings:', type: 'system' as const, priority: -5 },
    { title: 'Systemsteuerung', path: 'control', type: 'system' as const, priority: -5 },
    { title: 'Registrierungs-Editor (Regedit)', path: 'regedit', type: 'system' as const, priority: -5 },
    { title: 'Task-Manager', path: 'taskmgr', type: 'system' as const, priority: -5 },
    { title: 'Datei-Explorer', path: 'explorer', type: 'system' as const, priority: -5 },
    { title: 'Rechner', path: 'calc', type: 'system' as const, priority: -5 },
    { title: 'Editor (Notepad)', path: 'notepad', type: 'system' as const, priority: -5 },
    { title: 'Eingabeaufforderung (CMD)', path: 'cmd', type: 'system' as const, priority: -5 },
    { title: 'PowerShell', path: 'powershell', type: 'system' as const, priority: -5 },
    { title: 'Geräte-Manager', path: 'devmgmt.msc', type: 'system' as const, priority: -5 }
  ];
  indexItems.push(...tools);
}

async function scanStartMenu() {
  const paths = [
    join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    join(homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'),
  ];
  for (const p of paths) await crawl(p, 'app', 0, 10);
}

// ========================
// STEAM: Find games + their AppIDs so we can launch via steam://rungameid/
// ========================
async function scanSteamGames() {
  const steamRoots = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam', 'D:\\SteamLibrary',
    'E:\\Steam', 'E:\\SteamLibrary',
    'F:\\Steam', 'F:\\SteamLibrary',
    'G:\\Steam', 'G:\\SteamLibrary',
  ];

  // Also parse libraryfolders.vdf for extra library paths
  try {
    const vdfPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf';
    const vdf = await fs.readFile(vdfPath, 'utf-8');
    const pathMatches = vdf.match(/"path"\s+"([^"]+)"/g);
    if (pathMatches) {
      for (const m of pathMatches) {
        const p = m.match(/"path"\s+"([^"]+)"/)?.[1]?.replace(/\\\\/g, '\\');
        if (p && !steamRoots.includes(p)) steamRoots.push(p);
      }
    }
  } catch(e) {}

  for (const root of steamRoots) {
    const appsDir = join(root, 'steamapps');
    try {
      const files = await fs.readdir(appsDir);
      for (const f of files) {
        if (!f.startsWith('appmanifest_') || !f.endsWith('.acf')) continue;
        try {
          const content = await fs.readFile(join(appsDir, f), 'utf-8');
          const appId = content.match(/"appid"\s+"(\d+)"/)?.[1];
          const name = content.match(/"name"\s+"([^"]+)"/)?.[1];
          const installDir = content.match(/"installdir"\s+"([^"]+)"/)?.[1];
          if (appId && name && installDir) {
            indexItems.push({
              title: name,
              path: `steam://rungameid/${appId}`,
              type: 'game',
              priority: 0
            });
          }
        } catch(e) {}
      }
    } catch(e) {}
  }
}

async function scanEpicGames() {
  const paths = ['C:\\Program Files\\Epic Games', 'D:\\Epic Games', 'E:\\Epic Games', 'F:\\Epic Games'];
  for (const ep of paths) {
    try {
      const entries = await fs.readdir(ep, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'Launcher') {
          const exePath = await findMainExe(join(ep, entry.name));
          indexItems.push({
            title: entry.name,
            path: exePath || join(ep, entry.name),
            type: 'game',
            priority: 1
          });
        }
      }
    } catch(e) {}
  }
}

async function scanRiotGames() {
  const paths = ['C:\\Riot Games', 'D:\\Riot Games'];
  for (const rp of paths) {
    try {
      const entries = await fs.readdir(rp, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const exePath = await findMainExe(join(rp, entry.name));
          indexItems.push({
            title: entry.name,
            path: exePath || join(rp, entry.name),
            type: 'game',
            priority: 1
          });
        }
      }
    } catch(e) {}
  }
}

async function scanUserFolders() {
  const home = homedir();
  for (const folder of ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Videos', 'Music']) {
    await crawl(join(home, folder), 'file', 2, 3);
  }
}

async function scanProgramFiles() {
  for (const dir of ['C:\\Program Files', 'C:\\Program Files (x86)', 'D:\\Program Files']) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const exePath = await findMainExe(join(dir, entry.name));
          indexItems.push({
            title: entry.name,
            path: exePath || join(dir, entry.name),
            type: 'app',
            priority: 3
          });
        }
      }
    } catch(e) {}
  }
}

async function scanAllDrives() {
  for (const letter of ['C', 'D', 'E', 'F', 'G', 'H']) {
    const root = `${letter}:\\`;
    try {
      await fs.access(root);
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
        if (['Program Files', 'Program Files (x86)', 'Users', 'ProgramData'].includes(entry.name)) continue;
        await crawl(join(root, entry.name), 'file', 5, 2);
      }
    } catch(e) {}
  }
}

// Find the main .exe in a game/app directory
async function findMainExe(dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const exes = entries
      .filter(e => !e.isDirectory() && e.name.toLowerCase().endsWith('.exe'))
      .filter(e => !SKIP_EXES.has(e.name.toLowerCase()))
      .map(e => e.name);

    if (exes.length === 0) return null;
    if (exes.length === 1) return join(dir, exes[0]);

    // Prefer exe matching folder name
    const folderName = dir.split('\\').pop()?.toLowerCase() || '';
    const match = exes.find(e => e.toLowerCase().replace('.exe', '').includes(folderName));
    if (match) return join(dir, match);

    // Prefer largest exe (usually the main game binary)
    let largest = { name: exes[0], size: 0 };
    for (const exe of exes) {
      try {
        const stat = await fs.stat(join(dir, exe));
        if (stat.size > largest.size) {
          largest = { name: exe, size: stat.size };
        }
      } catch(e) {}
    }
    return join(dir, largest.name);
  } catch(e) { return null; }
}

async function crawl(dir: string, defaultType: 'app' | 'file', priority: number, maxDepth: number, depth = 0) {
  if (depth > maxDepth) return;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const nameLower = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(nameLower)) {
          await crawl(fullPath, defaultType, priority + 1, maxDepth, depth + 1);
        }
      } else {
        const dotIdx = nameLower.lastIndexOf('.');
        const ext = dotIdx >= 0 ? nameLower.substring(dotIdx) : '';
        if (APP_EXTS.has(ext)) {
          indexItems.push({ title: entry.name.replace(/\.(lnk|url)$/i, ''), path: fullPath, type: 'app', priority });
        } else if (ALL_EXTS.has(ext)) {
          indexItems.push({ title: entry.name, path: fullPath, type: 'file', priority: priority + 1 });
        }
      }
    }
  } catch(e) {}
}

buildIndex();

// ========================
// Search
// ========================
function searchIndex(query: string): IndexItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const scored: {item: IndexItem, score: number}[] = [];

  for (const item of indexItems) {
    const titleLower = item.title.toLowerCase();
    if (!terms.every(t => titleLower.includes(t))) continue;

    let score = 0;
    if (titleLower === query.toLowerCase()) score += 100;
    if (titleLower.startsWith(terms[0])) score += 50;
    if (item.type === 'system') score += 30;
    if (item.type === 'game') score += 25;
    if (item.type === 'app') score += 20;
    score -= item.priority * 2;
    score -= item.title.length * 0.1;

    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 15).map(s => s.item);
}

// ========================
// Window Management
// ========================
let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 750,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true  // Enable <webview> for inline AI & web
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('blur', () => {
    // Don't hide if devtools are focused
    if (mainWindow?.webContents.isDevToolsOpened()) return;
    mainWindow?.hide();
  });

  mainWindow.on('ready-to-show', () => {
    if (isDev) mainWindow?.show();
  });
}

function toggleWindow() {
  if (mainWindow?.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
}

app.whenReady().then(() => {
  createWindow();
  const success = globalShortcut.register('Alt+Space', toggleWindow);
  console.log(success ? '[WindowsBar] Alt+Space registered' : '[WindowsBar] Shortcut FAILED');
  app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});

// ========================
// IPC
// ========================

ipcMain.handle('search-everything', async (_event, query: string) => {
  if (!query?.trim()) return [];
  const top15 = searchIndex(query);

  // Extract native file icons for apps and games
  const withIcons = await Promise.all(top15.map(async (item) => {
    let iconBase64 = null;
    if (['app', 'game', 'system'].includes(item.type) && item.path && !item.path.startsWith('steam://')) {
      try {
        const img = await app.getFileIcon(item.path, { size: 'normal' });
        if (!img.isEmpty()) {
          iconBase64 = img.toDataURL();
        }
      } catch(e) {}
    }
    return { ...item, iconBase64 };
  }));

  return withIcons;
});

ipcMain.handle('fetch-instant-answer', async (_event, query: string) => {
  const results = [];
  const trimQuery = query.trim();

  // 1. Math eval
  try {
    if (/^[0-9+\-*/().\s]{3,}$/.test(trimQuery)) {
      const res = new Function(`return (${trimQuery})`)();
      if (res !== undefined && !isNaN(res)) {
        results.push({ title: `${res}`, subtitle: `Ergebnis von ${trimQuery}`, type: 'calc', path: `${res}`, isWeb: true });
      }
    }
  } catch(e) {}

  // 2. Weather
  if (trimQuery.toLowerCase().startsWith('wetter')) {
    try {
      const city = trimQuery.substring(6).trim() || '';
      // format: %t (temp), %C (condition), %w (wind)
      // lang: de
      const wRes = await net.fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%t|%C|%w&lang=de`);
      if (wRes.ok) {
        const text = await wRes.text();
        const parts = text.split('|');
        if (parts.length >= 2 && !text.includes('Unknown')) {
          results.push({
            title: `Wetter ${city ? city : 'Aktuell'}`,
            subtitle: `${parts[0].trim()}, ${parts[1].trim()} (Wind: ${parts[2]?.trim() || ''})`,
            type: 'weather',
            path: `https://www.google.com/search?q=wetter+${encodeURIComponent(city)}`,
            isWeb: true
          });
        }
      }
    } catch(e) {}
  }

  // 3. DuckDuckGo Instant Answer / Wikipedia
  try {
    const dRes = await net.fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(trimQuery)}&format=json&no_html=1&skip_disambig=1&kad=de_DE`);
    if (dRes.ok) {
      const dJson = await dRes.json() as any;
      if (dJson.AbstractText) {
        results.push({
          title: dJson.Heading || trimQuery,
          subtitle: dJson.AbstractText,
          type: 'web',
          path: dJson.AbstractURL || `https://www.google.com/search?q=${encodeURIComponent(trimQuery)}`,
          isWeb: true
        });
      }
    }
  } catch(e) {}

  // 4. Google Auto-complete Fallback
  try {
    const sRes = await net.fetch(`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(trimQuery)}`);
    if (sRes.ok) {
      const sJson = await sRes.json() as any;
      const suggestions = sJson[1] || [];
      for (const s of suggestions.slice(0, 4)) {
        // Skip adding the exact same query if we already added a DuckDuckGo result
        if (results.some(r => r.title.toLowerCase() === s.toLowerCase())) continue;
        results.push({
          title: `"${s}" suchen`,
          subtitle: 'Google Suche im Browser',
          type: 'web',
          path: `https://www.google.com/search?q=${encodeURIComponent(s)}`,
          isWeb: true
        });
      }
    }
  } catch(e) {}

  // If nothing found, add direct search
  if (results.length === 0) {
    results.push({
      title: `Nach "${trimQuery}" suchen`,
      subtitle: 'Google Suche im Browser öffnen',
      type: 'web',
      path: `https://www.google.com/search?q=${encodeURIComponent(trimQuery)}`,
      isWeb: true
    });
  }

  return results;
});

ipcMain.on('hide-window', () => mainWindow?.hide());

ipcMain.on('open-url', (_event, url: string) => {
  shell.openExternal(url);
  mainWindow?.hide();
});

ipcMain.on('open-file', (_event, filePath: string) => {
  // Support steam:// protocol links
  if (filePath.startsWith('steam://')) {
    shell.openExternal(filePath);
  } else {
    shell.openPath(filePath);
  }
  mainWindow?.hide();
});

ipcMain.on('resize-window', (_event, width: number, height: number) => {
  if (mainWindow) {
    mainWindow.setSize(width, height, true);
    mainWindow.center();
  }
});

let termProc: ChildProcess | null = null;

ipcMain.on('start-terminal', (event) => {
  if (termProc) {
    try { termProc.kill(); } catch (e) {}
  }
  
  // Use standard cmd.exe. 
  // We don't use node-pty to avoid native c++ build failures.
  // We'll manage input via full lines from the React UI.
  termProc = spawn('cmd.exe', [], {
    cwd: homedir(),
    env: process.env,
  });

  termProc.stdout?.on('data', (data) => {
    event.reply('terminal-output', data.toString());
  });

  termProc.stderr?.on('data', (data) => {
    event.reply('terminal-output', data.toString());
  });

  termProc.on('close', () => {
    event.reply('terminal-output', '\r\n[Process exited]\r\n');
  });

  // Automatically start gemini CLI once cmd is ready
  setTimeout(() => {
    if (termProc && termProc.stdin) {
      termProc.stdin.write('gemini\r\n');
    }
  }, 600);
});

ipcMain.on('terminal-input', (_event, data: string) => {
  if (termProc && termProc.stdin) {
    termProc.stdin.write(data);
  }
});

ipcMain.on('stop-terminal', () => {
  if (termProc) {
    try { termProc.kill(); } catch (e) {}
    termProc = null;
  }
});
