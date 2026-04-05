import { app, BrowserWindow, globalShortcut, ipcMain, shell, net, screen, powerSaveBlocker } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { execSync, spawn, ChildProcess, exec } from 'child_process';

// ========================
// CUSTOM FAST INDEXER
// ========================

interface IndexItem {
  title: string;
  path: string;       // file path or steam:// URL
  type: 'app' | 'file' | 'game' | 'system' | 'folder';
  priority: number;
  realPath?: string;  // actual folder path for icon fetching
  iconPath?: string;  // cached path to extract icon from
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
// ========================
// STEAM: Finding and indexing games
// ========================

function getSteamPath(): string | null {
  try {
    const out = execSync('reg query HKCU\\Software\\Valve\\Steam /v SteamPath').toString();
    const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/);
    if (match) return match[1].trim().replace(/\//g, '\\');
  } catch (e) { }
  // Common fallbacks
  const fallbacks = ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam', 'D:\\Steam', 'E:\\Steam'];
  for (const f of fallbacks) {
    try {
      if (require('fs').existsSync(f)) return f;
    } catch (e) { }
  }
  return null;
}

async function scanSteamGames() {
  const steamPath = getSteamPath();
  if (!steamPath) {
    console.log('[WindowsBar] Steam not found.');
    return;
  }

  const libraryRoots = [steamPath];

  // Also parse libraryfolders.vdf to find games on other drives/folders
  try {
    const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf');
    const vdf = await fs.readFile(vdfPath, 'utf-8');
    const pathMatches = vdf.match(/"path"\s+"([^"]+)"/g);
    if (pathMatches) {
      for (const m of pathMatches) {
        const p = m.match(/"path"\s+"([^"]+)"/)?.[1]?.replace(/\\\\/g, '\\');
        if (p && !libraryRoots.includes(p)) libraryRoots.push(p);
      }
    }
  } catch (e) {
    console.log('[WindowsBar] Could not read libraryfolders.vdf');
  }

  console.log(`[WindowsBar] Scanning ${libraryRoots.length} Steam libraries:`, libraryRoots);

  for (const root of libraryRoots) {
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
            const gameFolder = join(root, 'steamapps', 'common', installDir);
            // Find main EXE during indexing for faster icon retrieval
            const exePath = await findMainExe(gameFolder);
            indexItems.push({
              title: name,
              path: `steam://rungameid/${appId}`,
              realPath: gameFolder,
              iconPath: exePath || gameFolder, // Use EXE or folder for icon
              type: 'game',
              priority: 0
            });
          }
        } catch (e) { }
      }
    } catch (e) { }
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
            iconPath: exePath || undefined, // Use EXE for icon
            type: exePath ? 'game' : 'folder',
            priority: 1
          });
        }
      }
    } catch (e) { }
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
            iconPath: exePath || undefined, // Use EXE for icon
            type: exePath ? 'game' : 'folder',
            priority: 1
          });
        }
      }
    } catch (e) { }
  }
}

async function scanUserFolders() {
  const folders: (Parameters<typeof app.getPath>[0])[] = ['desktop', 'downloads', 'documents', 'pictures', 'videos', 'music'];
  for (const pf of folders) {
    try {
      const fullPath = app.getPath(pf);
      indexItems.push({ title: pf.charAt(0).toUpperCase() + pf.slice(1), path: fullPath, type: 'folder', priority: 0 });
      await crawl(fullPath, 'file', 2, 3);
    } catch (e) { }
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
            iconPath: exePath || undefined, // Use EXE for icon
            type: exePath ? 'app' : 'folder',
            priority: 3
          });
        }
      }
    } catch (e) { }
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
    } catch (e) { }
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
      } catch (e) { }
    }
    return join(dir, largest.name);
  } catch (e) { return null; }
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
          // Index the folder itself
          indexItems.push({ title: entry.name, path: fullPath, type: 'folder', priority: priority + 1 });
          await crawl(fullPath, defaultType, priority + 1, maxDepth, depth + 1);
        }
      } else {
        const dotIdx = nameLower.lastIndexOf('.');
        const ext = dotIdx >= 0 ? nameLower.substring(dotIdx) : '';
        if (APP_EXTS.has(ext)) {
          // For shortcuts, try to resolve the target for better icons
          let iconPath: string | undefined;
          if (nameLower.endsWith('.lnk')) {
            try {
              const sh = shell.readShortcutLink(fullPath);
              // Prefer explicit icon, then target
              if (sh.icon && sh.icon.trim()) {
                iconPath = sh.icon;
              } else if (sh.target) {
                iconPath = sh.target;
              }
            } catch (e) { }
          } else if (nameLower.endsWith('.url')) {
            // Parse .url file to extract IconFile
            try {
              const content = require('fs').readFileSync(fullPath, 'utf-8');
              const iconMatch = content.match(/IconFile=(.+)/i);
              if (iconMatch?.[1]) {
                let extractedPath = iconMatch[1].trim().replace(/^["']|["']$/g, '');
                // Handle relative paths
                if (!extractedPath.match(/^[A-Za-z]:\\/)) {
                  const urlDir = fullPath.substring(0, fullPath.lastIndexOf('\\'));
                  const absPath = join(urlDir, extractedPath);
                  try {
                    if (require('fs').existsSync(absPath)) {
                      extractedPath = absPath;
                    }
                  } catch (e) { }
                }
                iconPath = extractedPath;
              }
              // If no IconFile, try to get URL and detect type
              if (!iconPath) {
                const urlMatch = content.match(/URL=(.+)/i);
                if (urlMatch?.[1]) {
                  const url = urlMatch[1].trim();
                  // Steam URLs
                  const steamMatch = url.match(/steam:\/\/rungameid\/(\d+)/i);
                  if (steamMatch) {
                    const steamPath = getSteamPath();
                    if (steamPath) {
                      iconPath = join(steamPath, 'steam', 'games', `${steamMatch[1]}.ico`);
                    }
                  }
                  // HTTP URLs - will use browser icon later
                }
              }
            } catch (e) { }
          } else if (nameLower.endsWith('.exe')) {
            iconPath = fullPath; // EXE files are their own icon source
          }

          // Fallback: if no iconPath found, use the file itself
          if (!iconPath) {
            iconPath = fullPath;
          }

          indexItems.push({
            title: entry.name.replace(/\.(lnk|url)$/i, ''),
            path: fullPath,
            iconPath,
            type: 'app',
            priority
          });
        } else if (ALL_EXTS.has(ext)) {
          indexItems.push({ title: entry.name, path: fullPath, type: 'file', priority: priority + 1 });
        }
      }
    }
  } catch (e) { }
}

// buildIndex() moved to whenReady

// ========================
// Search Logic (Improved Relevance)
// ========================
function searchIndex(query: string): IndexItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const scored: { item: IndexItem, score: number }[] = [];
  const home = homedir().toLowerCase();

  for (const item of indexItems) {
    const titleLower = item.title.toLowerCase();
    if (!terms.every(t => titleLower.includes(t))) continue;

    let score = 0;
    const pathLower = item.path.toLowerCase();

    // 1. Exact Name Boost (Strongest)
    if (titleLower === query.toLowerCase()) score += 500;
    else if (titleLower.startsWith(terms[0])) score += 200;

    // 2. Primary User Folder Boost (Downloads, Desktop, etc.)
    // If it's one of the main user folders, give it a massive boost
    if (pathLower.startsWith(home)) {
      score += 150; // Generic home folder boost

      const userFolders = ['downloads', 'desktop', 'documents', 'pictures', 'videos', 'music'];
      for (const uf of userFolders) {
        if (pathLower === join(home, uf).toLowerCase()) {
          score += 1000; // Priority 1 for these specific folders
          break;
        }
      }
    }

    // 3. Type Boosts
    if (item.type === 'folder') score += 50;
    if (item.type === 'game') score += 40;
    if (item.type === 'app') score += 30;
    if (item.type === 'system') score += 20;

    // 4. Nesting Penalty (Favor shallow paths)
    const depth = item.path.split('\\').length;
    score -= (depth * 20);

    // 5. Initial Priority (from indexing)
    score -= (item.priority || 0) * 5;

    // 6. Name length penalty (Favor shorter/more precise matches)
    score -= item.title.length * 0.5;

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
  buildIndex(); // Index after app is ready to use app.getPath
  const success = globalShortcut.register('Alt+Space', toggleWindow);
  console.log(success ? '[WindowsBar] Alt+Space registered' : '[WindowsBar] Shortcut FAILED');
  app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { });

// ========================
// IPC
// ========================

ipcMain.handle('search-everything', async (_event, query: string) => {
  if (!query?.trim()) return [];
  const top15 = searchIndex(query);

  // Return results without icons - frontend uses type-specific fallback icons
  return top15.map(item => ({ ...item, iconBase64: null }));
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
  } catch (e) { }

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
    } catch (e) { }
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
  } catch (e) { }

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
  } catch (e) { }

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

ipcMain.handle('list-directory', async (_event, dirPath: string) => {
  try {
    let entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Fallback for redirected user folders
    if (entries.length === 0) {
      const lowerPath = dirPath.toLowerCase();
      if (lowerPath.includes('downloads') || lowerPath.includes('desktop')) {
        const altPath = lowerPath.includes('downloads') ? join(homedir(), 'Downloads') : join(homedir(), 'Desktop');
        if (altPath.toLowerCase() !== lowerPath) {
          try { entries = await fs.readdir(altPath, { withFileTypes: true }); } catch (e) { }
        }
      }
    }

    const visibleResults = entries.filter(e => !e.name.startsWith('.') && !e.name.startsWith('$'));

    if (visibleResults.length === 0 && entries.length > 0) {
      return [{ title: '(Nur versteckte/Systemdateien gefunden)', path: dirPath, type: 'file', iconBase64: null }];
    }

    // Return immediately with types only (no custom icons for speed)
    return visibleResults.slice(0, 30).map(entry => {
      const name = entry.name;
      const fullPath = join(dirPath, name);
      let type: 'folder' | 'file' | 'app' = entry.isDirectory() ? 'folder' : 'file';
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      if (type === 'file' && APP_EXTS.has(ext)) type = 'app';

      return {
        title: name,
        path: fullPath,
        type,
        iconBase64: null // Frontend uses generic type icons
      };
    });
  } catch (e) {
    console.error('list-directory error', e);
    return [];
  }
});

ipcMain.on('start-terminal', (event) => {
  if (termProc) {
    try { termProc.kill(); } catch (e) { }
  }

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
    try { termProc.kill(); } catch (e) { }
    termProc = null;
  }
});

// ========================
// SYSTEM FUNCTIONS
// ========================

// System Monitor
ipcMain.handle('get-system-info', async () => {
  try {
    const os = require('os');
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    // Get disk info using wmic
    let diskInfo = { total: 0, free: 0 };
    try {
      const diskOutput = execSync('wmic logicaldisk get size,freespace /format:csv', { encoding: 'utf-8' });
      const lines = diskOutput.trim().split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        const parts = lines[1].split(',');
        if (parts.length >= 2) {
          diskInfo.free = parseInt(parts[0]) || 0;
          diskInfo.total = parseInt(parts[1]) || 0;
        }
      }
    } catch (e) { }

    return {
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0,
        loadAvg1: loadAvg[0]?.toFixed(2) || '0',
        loadAvg5: loadAvg[1]?.toFixed(2) || '0',
        loadAvg15: loadAvg[2]?.toFixed(2) || '0'
      },
      memory: {
        total: Math.round(totalMem / (1024 * 1024 * 1024)), // GB
        used: Math.round(usedMem / (1024 * 1024 * 1024)), // GB
        free: Math.round(freeMem / (1024 * 1024 * 1024)), // GB
        usedPercent: Math.round((usedMem / totalMem) * 100)
      },
      disk: {
        total: Math.round(diskInfo.total / (1024 * 1024 * 1024)), // GB
        free: Math.round(diskInfo.free / (1024 * 1024 * 1024)), // GB
        usedPercent: diskInfo.total > 0 ? Math.round(((diskInfo.total - diskInfo.free) / diskInfo.total) * 100) : 0
      }
    };
  } catch (e) {
    console.error('get-system-info error:', e);
    return null;
  }
});

// Sleep Display (Turn off monitor)
ipcMain.on('sleep-display', () => {
  try {
    exec('powershell -command "(Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'{SCROLLLOCK}{SCROLLLOCK}\'))"', (error) => {
      if (error) console.error('Sleep error:', error);
    });
    // Alternative: Use SendMessage to turn off monitor
    setTimeout(() => {
      exec('powershell -command "Add-Type -TypeDefinition \\"using System; using System.Runtime.InteropServices; public class PM { [DllImport(\\"user32.dll\\\")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam); }\\"; [PM]::SendMessage(0xFFFF, 0x0112, 0, 2)"', (e) => {
        if (e) console.error('Monitor off error:', e);
      });
    }, 100);
  } catch (e) {
    console.error('sleep-display error:', e);
  }
});

// Volume Control
ipcMain.on('set-volume', (_event, level: number) => {
  try {
    // level: 0-100
    const safeLevel = Math.max(0, Math.min(100, level));
    exec(`powershell -command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]${safeLevel})"`, (error) => {
      if (error) console.error('Volume error:', error);
    });
    // Alternative using nircmd or simple approach
    exec(`powershell -command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`, () => { }); // Mute toggle workaround
  } catch (e) {
    console.error('set-volume error:', e);
  }
});

ipcMain.on('toggle-mute', () => {
  try {
    exec('powershell -command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', (error) => {
      if (error) console.error('Mute error:', error);
    });
  } catch (e) {
    console.error('toggle-mute error:', e);
  }
});

// Empty Trash
ipcMain.on('empty-trash', () => {
  try {
    exec('powershell -command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', (error) => {
      if (error) console.error('Empty trash error:', error);
    });
  } catch (e) {
    console.error('empty-trash error:', e);
  }
});

// Screenshot
ipcMain.on('take-screenshot', (event) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const screenshotPath = join(homedir(), 'Pictures', `screenshot-${timestamp}.png`);

    // Use PowerShell to capture screen
    exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Location, [System.Drawing.Point]::Empty, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Size); $bitmap.Save('${screenshotPath}'); $graphics.Dispose(); $bitmap.Dispose()"`, (error) => {
      if (error) {
        console.error('Screenshot error:', error);
        event.reply('screenshot-result', { success: false, error: error.message });
      } else {
        event.reply('screenshot-result', { success: true, path: screenshotPath });
      }
    });
  } catch (e) {
    console.error('take-screenshot error:', e);
    event.reply('screenshot-result', { success: false, error: String(e) });
  }
});

// Kill Process
ipcMain.handle('kill-process', async (_event, processName: string) => {
  try {
    if (!processName || processName.length < 2) {
      return { success: false, error: 'Invalid process name' };
    }

    // Sanitize input - only allow alphanumeric and some safe chars
    const safeName = processName.replace(/[^a-zA-Z0-9_.-]/g, '');

    if (safeName.length < 2) {
      return { success: false, error: 'Invalid process name after sanitization' };
    }

    exec(`taskkill /f /im "${safeName}.exe"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Kill process error:', error);
      }
    });

    return { success: true, message: `Attempting to kill ${safeName}.exe` };
  } catch (e) {
    console.error('kill-process error:', e);
    return { success: false, error: String(e) };
  }
});

// List running processes
ipcMain.handle('list-processes', async () => {
  try {
    const output = execSync('tasklist /fo csv /nh', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    const lines = output.trim().split('\n');
    const processes: { name: string; pid: string; memory: string }[] = [];

    for (const line of lines.slice(0, 30)) {
      const parts = line.match(/"([^"]+)"/g);
      if (parts && parts.length >= 5) {
        processes.push({
          name: parts[0]?.replace(/"/g, '') || '',
          pid: parts[1]?.replace(/"/g, '') || '',
          memory: parts[4]?.replace(/"/g, '') || ''
        });
      }
    }

    return processes;
  } catch (e) {
    console.error('list-processes error:', e);
    return [];
  }
});

// Clipboard read/write for frontend
ipcMain.handle('read-clipboard', async () => {
  try {
    const text = execSync('powershell -command "Get-Clipboard"', { encoding: 'utf-8' });
    return text.trim();
  } catch (e) {
    return '';
  }
});

ipcMain.on('write-clipboard', (_event, text: string) => {
  try {
    // Escape quotes and special chars for PowerShell
    const escaped = text.replace(/'/g, "''").replace(/\n/g, '`n');
    exec(`powershell -command "Set-Clipboard -Value '${escaped}'"`);
  } catch (e) {
    console.error('write-clipboard error:', e);
  }
});
