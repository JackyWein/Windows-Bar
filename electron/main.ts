import { app, BrowserWindow, globalShortcut, ipcMain, shell, net, screen, powerSaveBlocker, safeStorage } from 'electron';
import { join } from 'path';
import { promises as fs, watch as fsWatch } from 'fs';
import type { FSWatcher } from 'fs';
import { homedir } from 'os';
import { execSync, spawn, ChildProcess, exec } from 'child_process';
import { tryGetIconWithRetry, iconCache } from './utils/icons';
import { autoUpdater } from 'electron-updater';
import { searchEverything, isEverythingRunning } from './indexers/everything';
import { searchWithWindowsIndex } from './indexers/windowsSearch';

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

// ========================
// FILE SYSTEM WATCHER - Real-time index updates
// ========================
const activeWatchers: FSWatcher[] = [];
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 2000; // Wait 2 seconds before re-indexing

// Folders to watch for changes (high-priority user folders)
function getWatchPaths(): string[] {
  const paths: string[] = [];

  // User folders
  const userFolderNames: (Parameters<typeof app.getPath>[0])[] = ['desktop', 'downloads', 'documents'];
  for (const pf of userFolderNames) {
    try {
      paths.push(app.getPath(pf));
    } catch (e) { }
  }

  // Start Menu
  paths.push(
    join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    join(homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs')
  );

  return paths.filter(p => {
    try {
      require('fs').existsSync(p);
      return true;
    } catch {
      return false;
    }
  });
}

// Debounced re-index for a specific path
async function reindexPath(changedPath: string) {
  console.log(`[WindowsBar] Re-indexing changed path: ${changedPath}`);

  // Remove old items from this path
  const changedPathLower = changedPath.toLowerCase();
  indexItems = indexItems.filter(item => !item.path.toLowerCase().startsWith(changedPathLower));

  // Determine type based on path
  let defaultType: 'app' | 'file' = 'file';
  let priority = 5;

  if (changedPath.toLowerCase().includes('start menu')) {
    defaultType = 'app';
    priority = 0;
  } else if (changedPath.toLowerCase().includes('desktop')) {
    defaultType = 'file';
    priority = 2;
  } else if (changedPath.toLowerCase().includes('downloads')) {
    defaultType = 'file';
    priority = 2;
  }

  // Re-crawl the path
  try {
    await crawl(changedPath, defaultType, priority, 3);
  } catch (e) {
    console.error(`[WindowsBar] Error re-indexing ${changedPath}:`, e);
  }
}

// Handle file system events with debouncing
function handleFSEvent(eventType: string, filename: string | null, watchPath: string) {
  if (!filename) return;

  // Skip temporary and hidden files
  if (filename.startsWith('~') || filename.startsWith('.') || filename.endsWith('.tmp')) return;

  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set new timer
  debounceTimer = setTimeout(() => {
    console.log(`[WindowsBar] FS change detected: ${eventType} on ${filename} in ${watchPath}`);
    reindexPath(watchPath).catch(e => console.error('[WindowsBar] Re-index error:', e));
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

// Start watching critical folders
function startWatchers() {
  const watchPaths = getWatchPaths();
  console.log('[WindowsBar] Starting file watchers for:', watchPaths);

  for (const path of watchPaths) {
    try {
      const watcher = fsWatch(
        path,
        { recursive: true, persistent: false },
        (eventType, filename) => handleFSEvent(eventType, filename, path)
      );

      watcher.on('error', (error) => {
        console.error(`[WindowsBar] Watcher error for ${path}:`, error);
      });

      activeWatchers.push(watcher);
      console.log(`[WindowsBar] Watching: ${path}`);
    } catch (e) {
      console.error(`[WindowsBar] Failed to watch ${path}:`, e);
    }
  }
}

// Stop all watchers
function stopWatchers() {
  for (const watcher of activeWatchers) {
    watcher.close();
  }
  activeWatchers.length = 0;
  console.log('[WindowsBar] All file watchers stopped');
}

// Periodic background refresh (every 5 minutes) as fallback
let backgroundRefreshInterval: NodeJS.Timeout | null = null;

function startBackgroundRefresh() {
  backgroundRefreshInterval = setInterval(async () => {
    console.log('[WindowsBar] Background refresh triggered');
    try {
      // Quick re-scan of user folders only
      await scanUserFolders();
      await scanStartMenu();

      // Deduplicate
      const seen = new Map<string, boolean>();
      indexItems = indexItems.filter(item => {
        const key = item.path.toLowerCase();
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
      });

      console.log(`[WindowsBar] Background refresh complete: ${indexItems.length} items`);
    } catch (e) {
      console.error('[WindowsBar] Background refresh error:', e);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

function stopBackgroundRefresh() {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
    backgroundRefreshInterval = null;
  }
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
// AUTO UPDATER - Silent Background Updates
// ========================

// Configure auto-updater
autoUpdater.autoDownload = true;        // Automatically download updates
autoUpdater.autoInstallOnAppQuit = true; // Install on app quit (no user interaction)
autoUpdater.allowPrerelease = false;     // Only stable releases

// Check for updates silently (no user notification)
async function checkForUpdates() {
  if (isDev) {
    console.log('[WindowsBar] Skipping update check in dev mode');
    return;
  }

  try {
    console.log('[WindowsBar] Checking for updates...');
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('[WindowsBar] Update check failed:', error);
  }
}

// Auto-updater event handlers (silent - no UI notifications)
autoUpdater.on('checking-for-update', () => {
  console.log('[WindowsBar] Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[WindowsBar] Update available:', info.version);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[WindowsBar] No update available. Current version:', app.getVersion());
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  console.log(`[WindowsBar] Downloading update: ${percent}% (${progressObj.transferred}/${progressObj.total} bytes)`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[WindowsBar] Update downloaded:', info.version);
  console.log('[WindowsBar] Update will be installed on next app restart');
});

autoUpdater.on('error', (error) => {
  console.error('[WindowsBar] Auto-updater error:', error);
});

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
  buildIndex().then(() => {
    // Start file watchers after initial index is built
    startWatchers();
    startBackgroundRefresh();
  });
  const success = globalShortcut.register('Alt+Space', toggleWindow);
  console.log(success ? '[WindowsBar] Alt+Space registered' : '[WindowsBar] Shortcut FAILED');
  app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

  // Check for updates on startup (silent background update)
  checkForUpdates();

  // Also check for updates periodically every 4 hours
  setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopWatchers();
  stopBackgroundRefresh();
});
app.on('window-all-closed', () => { });

// ========================
// IPC
// ========================

// Unified search handler - combines all search methods for comprehensive results
ipcMain.handle('search-everything', async (_event, query: string) => {
  if (!query?.trim()) return [];

  const startTime = Date.now();
  const allResults: Map<string, IndexItem> = new Map(); // Use Map for deduplication by path

  // 1. First, search the built-in index (fast, always available)
  const localResults = searchIndex(query);
  for (const item of localResults) {
    allResults.set(item.path.toLowerCase(), item);
  }

  // 2. Try Everything search (if installed and running) - fastest comprehensive search
  if (isEverythingRunning()) {
    try {
      const everythingResults = await searchEverything(query, 30);
      for (const item of everythingResults) {
        const key = item.path.toLowerCase();
        if (!allResults.has(key)) {
          allResults.set(key, item);
        }
      }
      console.log(`[Unified Search] Everything found ${everythingResults.length} results`);
    } catch (e) {
      console.error('[Unified Search] Everything search failed:', e);
    }
  }

  // 3. If Everything is not available, try Windows Search Indexer
  if (!isEverythingRunning() && allResults.size < 15) {
    try {
      const windowsResults = await searchWithWindowsIndex(query, 20);
      for (const item of windowsResults) {
        const key = item.path.toLowerCase();
        if (!allResults.has(key)) {
          allResults.set(key, item);
        }
      }
      console.log(`[Unified Search] Windows Search found ${windowsResults.length} results`);
    } catch (e) {
      console.error('[Unified Search] Windows Search failed:', e);
    }
  }

  // Convert to array and sort by relevance
  const results = Array.from(allResults.values());

  // Sort: local index results first (they have better scoring), then by type
  results.sort((a, b) => {
    // Prioritize apps and games
    const typePriority: Record<string, number> = { 'app': 0, 'game': 1, 'folder': 2, 'file': 3, 'system': 4 };
    const aPriority = typePriority[a.type] ?? 5;
    const bPriority = typePriority[b.type] ?? 5;

    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.title.localeCompare(b.title);
  });

  const finalResults = results.slice(0, 30); // Return up to 30 results

  console.log(`[Unified Search] Total: ${finalResults.length} results in ${Date.now() - startTime}ms`);

  // Return results with iconPath for lazy icon fetching
  return finalResults.map(item => ({ ...item, iconBase64: null, iconPath: item.iconPath || item.path }));
});

// Icon cache for lazy loading
const fileIconCache = new Map<string, string | null>();

ipcMain.handle('get-file-icon', async (_event, filePath: string) => {
  if (!filePath) return null;
  if (fileIconCache.has(filePath)) return fileIconCache.get(filePath);

  const icon = await tryGetIconWithRetry(filePath);
  fileIconCache.set(filePath, icon);
  return icon;
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

    // Return with iconPath for lazy loading icons in frontend
    return visibleResults.slice(0, 30).map(entry => {
      const name = entry.name;
      const fullPath = join(dirPath, name);
      let type: 'folder' | 'file' | 'app' = entry.isDirectory() ? 'folder' : 'file';
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      if (type === 'file' && APP_EXTS.has(ext)) type = 'app';

      // Determine iconPath for lazy loading
      let iconPath: string | undefined;
      if (type === 'folder') {
        // Folders can have icons too (from folder.ico or the folder itself)
        iconPath = fullPath;
      } else if (type === 'app') {
        // For apps, try to resolve shortcut targets for better icons
        if (name.toLowerCase().endsWith('.lnk')) {
          try {
            const sh = shell.readShortcutLink(fullPath);
            iconPath = sh.icon || sh.target || fullPath;
          } catch {
            iconPath = fullPath;
          }
        } else if (name.toLowerCase().endsWith('.url')) {
          // Parse .url file to extract IconFile
          try {
            const content = require('fs').readFileSync(fullPath, 'utf-8');
            const iconMatch = content.match(/IconFile=(.+)/i);
            if (iconMatch?.[1]) {
              let extractedPath = iconMatch[1].trim().replace(/^["']|["']$/g, '');
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
            // If no IconFile, check for Steam URL
            if (!iconPath) {
              const urlMatch = content.match(/URL=(.+)/i);
              if (urlMatch?.[1]) {
                const url = urlMatch[1].trim();
                const steamMatch = url.match(/steam:\/\/rungameid\/(\d+)/i);
                if (steamMatch) {
                  const steamPath = getSteamPath();
                  if (steamPath) {
                    iconPath = join(steamPath, 'steam', 'games', `${steamMatch[1]}.ico`);
                  }
                }
              }
            }
          } catch {
            iconPath = fullPath;
          }
        } else {
          // For .exe and other apps, use the file itself
          iconPath = fullPath;
        }
      } else {
        // Regular files - use the file itself for icon extraction
        iconPath = fullPath;
      }

      return {
        title: name,
        path: fullPath,
        type,
        iconBase64: null,
        iconPath: iconPath || fullPath
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

// ========================
// PLUGIN SYSTEM
// ========================

const PLUGINS_DIR = join(app.getPath('userData'), 'plugins');

/** Ensure the plugins directory exists */
async function ensurePluginsDir(): Promise<void> {
  try { await fs.mkdir(PLUGINS_DIR, { recursive: true }); } catch { /* already exists */ }
}

/** Read and parse a plugin manifest.json */
async function readManifest(pluginDir: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(join(pluginDir, 'manifest.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

ipcMain.handle('plugin:list', async () => {
  await ensurePluginsDir();
  const plugins: Array<Record<string, unknown>> = [];

  try {
    const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifest = await readManifest(join(PLUGINS_DIR, entry.name));
      if (manifest) {
        plugins.push({
          id: manifest.id ?? entry.name,
          name: manifest.name ?? entry.name,
          version: manifest.version ?? '0.0.0',
          description: manifest.description ?? '',
          author: manifest.author ?? '',
          enabled: true,
          installed: true,
        });
      }
    }
  } catch (e) {
    console.error('plugin:list error:', e);
  }

  return plugins;
});

ipcMain.handle('plugin:install', async (_event, sourcePath: string) => {
  await ensurePluginsDir();

  // Read manifest from source
  const manifest = await readManifest(sourcePath);
  if (!manifest) {
    throw new Error('No manifest.json found in plugin folder');
  }

  const pluginId = String(manifest.id ?? 'unknown-plugin');
  const destDir = join(PLUGINS_DIR, pluginId);

  // Copy plugin files
  await fs.cp(sourcePath, destDir, { recursive: true, force: true });

  return {
    id: pluginId,
    name: String(manifest.name ?? pluginId),
    version: String(manifest.version ?? '0.0.0'),
    description: String(manifest.description ?? ''),
    author: String(manifest.author ?? ''),
    enabled: true,
    installed: true,
  };
});

ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
  const pluginDir = join(PLUGINS_DIR, pluginId);
  try {
    await fs.rm(pluginDir, { recursive: true, force: true });
  } catch (e) {
    console.error('plugin:uninstall error:', e);
    throw e;
  }
});

ipcMain.handle('plugin:toggle', async (_event, pluginId: string, enabled: boolean) => {
  // Plugin enabled state is managed on the renderer side via settings.
  // The main process just acknowledges the toggle.
  console.log(`[WindowsBar] Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
  return { id: pluginId, enabled };
});

// ========================
// AI CHAT IPC HANDLERS
// ========================

// Credential storage using Electron safeStorage (OS keychain encryption)
function getCredentialPath(): string {
  return join(app.getPath('userData'), 'ai-credentials.json');
}

async function loadCredentials(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(getCredentialPath(), 'utf-8');
    if (!safeStorage.isEncryptionAvailable()) return JSON.parse(raw);
    const decrypted = safeStorage.decryptString(Buffer.from(raw, 'utf-8'));
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

async function saveCredentials(creds: Record<string, string>): Promise<void> {
  const json = JSON.stringify(creds);
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    await fs.writeFile(getCredentialPath(), encrypted);
  } else {
    await fs.writeFile(getCredentialPath(), json);
  }
}

ipcMain.handle('store-credential', async (_event, key: string, value: string) => {
  const creds = await loadCredentials();
  creds[key] = value;
  await saveCredentials(creds);
  return true;
});

ipcMain.handle('get-credential', async (_event, key: string) => {
  const creds = await loadCredentials();
  return creds[key] ?? null;
});

ipcMain.handle('delete-credential', async (_event, key: string) => {
  const creds = await loadCredentials();
  delete creds[key];
  await saveCredentials(creds);
  return true;
});

// AI Chat proxy — executes API or CLI requests from the main process
// to avoid CORS issues in the renderer
let activeAiProcess: ChildProcess | null = null;

ipcMain.handle('ai:chat', async (event, request: {
  providerType: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cliCommand?: string;
  cliArgs?: string[];
  cliInput?: string;
}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) throw new Error('No window found');

  // CLI provider
  if (request.providerType === 'cli' && request.cliCommand) {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn(request.cliCommand!, request.cliArgs ?? [], {
        shell: true,
        env: { ...process.env },
      });
      activeAiProcess = proc;

      proc.stdout.on('data', (data: Buffer) => {
        win.webContents.send('ai:chunk', data.toString());
      });

      proc.stderr.on('data', (data: Buffer) => {
        win.webContents.send('ai:chunk', data.toString());
      });

      proc.on('close', () => {
        activeAiProcess = null;
        win.webContents.send('ai:complete', {});
        resolve();
      });

      proc.on('error', (err) => {
        activeAiProcess = null;
        win.webContents.send('ai:error', err.message);
        reject(err);
      });

      // Send input after a short delay
      if (request.cliInput) {
        setTimeout(() => {
          proc.stdin?.write(request.cliInput + '\n');
          proc.stdin?.end();
        }, 300);
      }
    });
  }

  // API provider
  if (request.url) {
    try {
      const response = await net.fetch(request.url, {
        method: 'POST',
        headers: request.headers ?? {},
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${errorBody}`);
      }

      const contentType = response.headers.get('content-type') ?? '';

      // Handle SSE streaming
      if (contentType.includes('text/event-stream') || request.body &&
        typeof request.body === 'object' && 'stream' in request.body &&
        (request.body as Record<string, unknown>).stream === true) {

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // OpenAI / Ollama format
                if (parsed.choices?.[0]?.delta?.content) {
                  const chunk = parsed.choices[0].delta.content;
                  fullContent += chunk;
                  win.webContents.send('ai:chunk', chunk);
                }

                // Anthropic format
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  fullContent += parsed.delta.text;
                  win.webContents.send('ai:chunk', parsed.delta.text);
                }

                // Gemini format
                if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                  const chunk = parsed.candidates[0].content.parts[0].text;
                  fullContent += chunk;
                  win.webContents.send('ai:chunk', chunk);
                }
              } catch {
                // Non-JSON line, skip
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        win.webContents.send('ai:complete', { content: fullContent });
        return { content: fullContent };
      }

      // Non-streaming response
      const data = await response.json();
      win.webContents.send('ai:complete', data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      win.webContents.send('ai:error', message);
      throw err;
    }
  }

  throw new Error('Invalid AI request: no URL or CLI command');
});

ipcMain.on('ai:abort', () => {
  if (activeAiProcess) {
    activeAiProcess.kill();
    activeAiProcess = null;
  }
});
