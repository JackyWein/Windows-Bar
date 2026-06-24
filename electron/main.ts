import { app, BrowserWindow, globalShortcut, ipcMain, shell, net, safeStorage, clipboard, nativeTheme } from 'electron';

// Handle squirrel events first
if (process.argv.length >= 2) {
  const arg = process.argv[1];
  if (arg.startsWith('--squirrel-')) {
    app.quit();
    process.exit(0);
  }
}

import { join } from 'path';
import { promises as fs, watch as fsWatch, readFileSync, writeFileSync } from 'fs';
import type { FSWatcher } from 'fs';
import { homedir, networkInterfaces, hostname } from 'os';
import * as dns from 'dns';
import * as https from 'https';

// ========================
// POWERSHELL HELPER — runs scripts via -EncodedCommand (UTF-16LE Base64).
// This eliminates all quoting/escaping issues and command-injection risks
// because the payload is never parsed by a shell.
// ========================
function runPowerShell(script: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.toString());
      },
    );
  });
}

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Unhandled Rejection]', error);
});

import { execSync, spawn, ChildProcess, exec, execFile } from 'child_process';
import { tryGetIconWithRetry, resolveShortcutIcon } from './utils/icons';
import { loadExternalCommands } from './utils/external-commands';
import { loadAllPlugins, registerPluginIPC } from './utils/plugins';
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
// NEU: Map statt einer einzelnen Variable
const debounceTimers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 2000;

function getWatchPaths(): string[] {
  const paths: string[] = [];

  // User folders
  const userFolderNames: (Parameters<typeof app.getPath>[0])[] = ['desktop', 'downloads', 'documents'];
  for (const pf of userFolderNames) {
    try {
      paths.push(app.getPath(pf));
    } catch { /* ignore invalid path */ }
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

// Handle file system events with debouncing per path
function handleFSEvent(eventType: string, filename: string | null, watchPath: string) {
  if (!filename) return;

  // Skip temporary and hidden files
  if (filename.startsWith('~') || filename.startsWith('.') || filename.endsWith('.tmp')) return;

  // Clear existing timer FOR THIS SPECIFIC PATH
  if (debounceTimers.has(watchPath)) {
    clearTimeout(debounceTimers.get(watchPath)!);
  }

  // Set new timer
  const timer = setTimeout(() => {
    console.log(`[WindowsBar] FS change detected: ${eventType} on ${filename} in ${watchPath}`);
    reindexPath(watchPath).catch(e => console.error('[WindowsBar] Re-index error:', e));
    debounceTimers.delete(watchPath);
  }, DEBOUNCE_MS);

  debounceTimers.set(watchPath, timer);
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
  } catch { /* ignore */ }
  // Common fallbacks
  const fallbacks = ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam', 'D:\\Steam', 'E:\\Steam'];
  for (const f of fallbacks) {
    try {
      if (require('fs').existsSync(f)) return f;
    } catch { /* ignore */ }
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
  } catch {
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
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
            iconPath = await resolveShortcutIcon(fullPath) || fullPath;
          } else if (nameLower.endsWith('.url')) {
            // Parse .url file to extract IconFile
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const iconMatch = content.match(/IconFile=(.+)/i);
              if (iconMatch?.[1]) {
                let extractedPath = iconMatch[1].trim().replace(/^["']|["']$/g, '');
                // Handle relative paths
                if (!extractedPath.match(/^[A-Za-z]:\\/)) {
                  const urlDir = fullPath.substring(0, fullPath.lastIndexOf('\\'));
                  const absPath = join(urlDir, extractedPath);
                  try { await fs.access(absPath); extractedPath = absPath; } catch (e) { }
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
// Fuzzy subsequence match: are all chars of `q` present in `t` in order? (e.g. "vsc" → "visual studio code")
function fuzzySubsequence(q: string, t: string): boolean {
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function searchIndex(query: string): IndexItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const scored: { item: IndexItem, score: number }[] = [];
  const home = homedir().toLowerCase();
  const singleTerm = terms.length === 1 ? terms[0] : null;

  for (const item of indexItems) {
    const titleLower = item.title.toLowerCase();
    const isSubstring = terms.every(t => titleLower.includes(t));
    // Allow fuzzy subsequence for single-word queries (e.g. "vsc" → "Visual Studio Code")
    const isFuzzy = !isSubstring && singleTerm !== null && singleTerm.length >= 2 && fuzzySubsequence(singleTerm, titleLower);
    if (!isSubstring && !isFuzzy) continue;

    let score = 0;
    if (isFuzzy) score -= 120; // fuzzy matches rank below real substring matches
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
// NOTE: We use a single, manual GitHub-API update flow (checkForUpdates/downloadAndInstall below).
// electron-updater's auto-download is disabled so the two paths can never race / double-download.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

let updateReady = false;
let installOnReady = false;
let currentDownloadProgress: number | null = null;
let isDownloading = false;
let updateExePath: string | null = null;

// Check for updates silently on startup using GitHub API (not electron-updater)
async function checkForUpdates() {
  if (isDev) {
    console.log('[WindowsBar] Skipping update check in dev mode');
    return;
  }
  
  // Don't re-download if already downloaded or in progress
  // But if we have the file, we can still show it
  if (updateReady || isDownloading) {
    console.log('[WindowsBar] Skipping download - already done or in progress');
    return;
  }
  
  // Check if we already have an installer in temp from previous run
  const tempDir = app.getPath('temp');
  try {
    const files = await fs.readdir(tempDir);
    const existingInstaller = files.find(f => f.includes('WindowsBar') && f.endsWith('.exe'));
    if (existingInstaller) {
      console.log('[WindowsBar] Found existing installer in temp');
      updateExePath = join(tempDir, existingInstaller);
      updateReady = true;
      // Notify the UI
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
        mainWindow.webContents.send('update-ready');
      }
      return;
    }
  } catch (e) {
    console.log('[WindowsBar] Could not check temp:', e);
  }

  try {
    const currentVersion = app.getVersion();
    console.log('[WindowsBar] Silent update check. Current:', currentVersion);
    
    const release: any = await fetchJSON('https://api.github.com/repos/JackyWein/Windows-Bar/releases/latest');
    const latestVersion = release.tag_name?.replace('v', '') || release.name;
    
    // Compare versions
    const curr = currentVersion.split('.').map(Number);
    const latest = latestVersion.split('.').map(Number);
    const needsUpdate = latest[0] > curr[0] || (latest[0] === curr[0] && latest[1] > curr[1]) || (latest[0] === curr[0] && latest[1] === curr[1] && latest[2] > curr[2]);
    
    if (!needsUpdate) {
      console.log('[WindowsBar] No update needed');
      return;
    }
    
    const asset = release.assets?.find((a: any) => a.name?.endsWith('.exe') && a.name.includes('Setup'));
    if (asset) {
      console.log('[WindowsBar] Background download started');
      isDownloading = true;
      downloadAndInstall(asset.browser_download_url, latestVersion).catch(e => {
        console.error('[WindowsBar] Background DL error:', e);
        isDownloading = false;
      });
    }
  } catch (e) {
    console.error('[WindowsBar] Silent check error:', e);
  }
}
   
// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('[WindowsBar] AU: Checking...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[WindowsBar] AU: Update available:', info.version);
  // Download is handled exclusively by the manual GitHub flow (downloadAndInstall).
});

autoUpdater.on('update-not-available', () => {
  console.log('[WindowsBar] AU: No update');
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  currentDownloadProgress = progressObj.percent;
  console.log(`[WindowsBar] AU: ${percent}% (${progressObj.transferred}/${progressObj.total})`);
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', progressObj.percent);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[WindowsBar] AU: DOWNLOADED:', info.version);
  updateReady = true;
  currentDownloadProgress = 100;
  if (installOnReady) {
    autoUpdater.quitAndInstall();
  }
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
    mainWindow.webContents.send('update-ready');
  }
});

autoUpdater.on('error', (error) => {
  console.error('[WindowsBar] UPDATER ERROR:', error.message);
});

// ========================
// Window Management
// ========================
let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

// Settings state (synced with renderer)
let appSettings = {
  autoStart: true,
  alwaysOnTop: true,
  overlayFullscreen: false,
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 750,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: true,  // Show window immediately on startup
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,  // Enable <webview> for inline AI & web
      backgroundThrottling: false // Prevent suspension when hidden
    }
  });

  // Set window to appear over fullscreen apps if overlayFullscreen is enabled
  if (appSettings.overlayFullscreen) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  }

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('blur', () => {
    // Don't hide if devtools are focused
    if (mainWindow?.webContents.isDevToolsOpened()) return;
    mainWindow?.hide();
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

// Customizable global hotkey — register/unregister dynamically.
let currentHotkey = 'Alt+Space';
function registerToggleHotkey(accelerator: string): { success: boolean; error?: string } {
  const accel = String(accelerator || '').trim();
  if (!accel) return { success: false, error: 'Leerer Hotkey' };
  try {
    if (currentHotkey) {
      try { globalShortcut.unregister(currentHotkey); } catch { /* ignore */ }
    }
    const ok = globalShortcut.register(accel, toggleWindow);
    if (ok) {
      currentHotkey = accel;
      return { success: true };
    }
    // Re-register the previous one if the new accelerator failed (e.g. already in use)
    try { globalShortcut.register(currentHotkey, toggleWindow); } catch { /* ignore */ }
    return { success: false, error: 'Hotkey konnte nicht registriert werden (evtl. schon belegt)' };
  } catch (e) {
    try { globalShortcut.register(currentHotkey, toggleWindow); } catch { /* ignore */ }
    return { success: false, error: String(e) };
  }
}

app.whenReady().then(async () => {
  createWindow();

  // Register plugin IPC handlers
  registerPluginIPC();

  // Ensure plugins directory exists (no longer bundled by default)
  try {
    const pluginsDir = join(app.getPath('userData'), 'plugins');
    await fs.mkdir(pluginsDir, { recursive: true });
  } catch (err) {
    console.error('[WindowsBar] Error ensuring plugins directory:', err);
  }

  // Load all plugins
  await loadAllPlugins();

  // Load external commands from user commands folder
  const externalCmds = await loadExternalCommands();
  const allExternalCommands = externalCmds.flatMap(ec => ec.commands);
  if (allExternalCommands.length > 0 && mainWindow) {
    mainWindow.webContents.send('external-commands', allExternalCommands);
  }

  buildIndex().then(() => {
    // Start file watchers after initial index is built
    startWatchers();
    startBackgroundRefresh();
  });
  const hk = registerToggleHotkey('Alt+Space');
  console.log(hk.success ? '[WindowsBar] Global hotkey registered (Alt+Space)' : `[WindowsBar] Hotkey FAILED: ${hk.error}`);
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
    // Return with iconPath for lazy loading icons in frontend (Asynchron gemacht!)
    const formattedResults = await Promise.all(visibleResults.slice(0, 30).map(async (entry) => {
      const name = entry.name;
      const fullPath = join(dirPath, name);
      let type: 'folder' | 'file' | 'app' = entry.isDirectory() ? 'folder' : 'file';
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      if (type === 'file' && APP_EXTS.has(ext)) type = 'app';

      let iconPath: string | undefined;
      if (type === 'folder') {
        iconPath = fullPath;
      } else if (type === 'app') {
        if (name.toLowerCase().endsWith('.lnk')) {
          // Do not resolve .lnk here, so app.getFileIcon can fetch custom shortcut icons
          iconPath = fullPath;
        } else if (name.toLowerCase().endsWith('.url')) {
          try {
            // Asynchrones Lesen blockiert die UI nicht!
            const content = await fs.readFile(fullPath, 'utf-8');
            const iconMatch = content.match(/IconFile=(.+)/i);
            if (iconMatch?.[1]) {
              let extractedPath = iconMatch[1].trim().replace(/^["']|["']$/g, '');
              if (!extractedPath.match(/^[A-Za-z]:\\/)) {
                const urlDir = fullPath.substring(0, fullPath.lastIndexOf('\\'));
                const absPath = join(urlDir, extractedPath);
                try {
                  await fs.access(absPath); // Asynchron!
                  extractedPath = absPath;
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
    }));
    return formattedResults;
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

    // Get disk info via Node's native statfs (no deprecated wmic, non-blocking).
    let diskInfo = { total: 0, free: 0 };
    try {
      const sysDrive = (process.env.SystemDrive || 'C:') + '\\';
      // fs.statfs is available on Node 18.15+/Electron 41
      const stat = await (fs as unknown as { statfs: (p: string) => Promise<{ bsize: number; blocks: number; bavail: number }> }).statfs(sysDrive);
      diskInfo.total = stat.blocks * stat.bsize;
      diskInfo.free = stat.bavail * stat.bsize;
    } catch (e) { /* statfs unavailable */ }

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

// Sleep Display (Turn off monitor) — correct SC_MONITORPOWER (0xF170) via WM_SYSCOMMAND.
ipcMain.on('sleep-display', () => {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MonitorCtl {
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  public static void Off() { SendMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)2); }
}
"@
[MonitorCtl]::Off()
`;
  runPowerShell(script).catch(e => console.error('sleep-display error:', e));
});

// ========================
// AUDIO CONTROL — real Core Audio (WASAPI) via PowerShell, no external tools.
// ========================
const AUDIO_CSHARP = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ep); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class AudioCtl {
  static IAudioEndpointVolume Vol() {
    var en = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev; Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(0, 1, out dev));
    Guid iid = typeof(IAudioEndpointVolume).GUID; object o;
    Marshal.ThrowExceptionForHR(dev.Activate(ref iid, 1, IntPtr.Zero, out o));
    return (IAudioEndpointVolume)o;
  }
  public static void SetVol(float l){ Vol().SetMasterVolumeLevelScalar(l, Guid.Empty); }
  public static void SetMute(bool m){ Vol().SetMute(m, Guid.Empty); }
  public static float GetVol(){ float v; Vol().GetMasterVolumeLevelScalar(out v); return v; }
  public static bool GetMute(){ bool m; Vol().GetMute(out m); return m; }
}
"@
`;

ipcMain.handle('set-volume-absolute', async (_event, level: number) => {
  const safe = Math.max(0, Math.min(100, Number(level) || 0)) / 100;
  try {
    await runPowerShell(`${AUDIO_CSHARP}\n[AudioCtl]::SetVol([float]${safe})`);
    return { success: true };
  } catch (e) {
    console.error('set-volume-absolute error:', e);
    return { success: false };
  }
});

// Legacy relative volume (kept for backward compat) — now routes to absolute via current+delta is impractical,
// so we just toggle mute is handled separately. set-volume sets absolute level.
ipcMain.on('set-volume', (_event, level: number) => {
  const safe = Math.max(0, Math.min(100, Number(level) || 0)) / 100;
  runPowerShell(`${AUDIO_CSHARP}\n[AudioCtl]::SetVol([float]${safe})`).catch(e => console.error('set-volume error:', e));
});

ipcMain.on('toggle-mute', () => {
  runPowerShell(`${AUDIO_CSHARP}\n[AudioCtl]::SetMute(-not [AudioCtl]::GetMute())`)
    .catch(e => console.error('toggle-mute error:', e));
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

    exec(`taskkill /f /im "${safeName}.exe"`, (error) => {
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

// Clipboard read/write for frontend — Electron native clipboard (safe, fast, Unicode-correct).
ipcMain.handle('read-clipboard', async () => {
  try {
    return clipboard.readText();
  } catch {
    return '';
  }
});

ipcMain.on('write-clipboard', (_event, text: string) => {
  try {
    clipboard.writeText(String(text ?? ''));
  } catch (e) {
    console.error('write-clipboard error:', e);
  }
});

// ========================
// RUN PROGRAM & POWER ACTIONS
// ========================
ipcMain.handle('run-program', async (_event, program: string) => {
  const p = String(program || '').trim();
  if (!p) return { success: false, error: 'Kein Programm angegeben' };
  try {
    // Protocol URIs (steam://, ms-settings:, https://) → open externally
    if (/^[a-z][a-z0-9+.-]*:(\/\/|[^/])/i.test(p)) {
      await shell.openExternal(p);
    } else {
      const child = spawn(p, [], { shell: true, detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
    }
    mainWindow?.hide();
    return { success: true };
  } catch (e) {
    console.error('run-program error:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.on('power-action', (_event, action: string) => {
  try {
    switch (action) {
      case 'lock': execFile('rundll32.exe', ['user32.dll,LockWorkStation']); break;
      case 'shutdown': execFile('shutdown', ['/s', '/t', '0']); break;
      case 'restart': execFile('shutdown', ['/r', '/t', '0']); break;
      case 'logoff': execFile('shutdown', ['/l']); break;
    }
  } catch (e) {
    console.error('power-action error:', e);
  }
});

// ========================
// NETWORK & SYSTEM TOOLS
// ========================
ipcMain.handle('get-local-ip', async () => {
  const ifaces = networkInterfaces();
  const ipv4: string[] = [];
  const ipv6: string[] = [];
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.internal) continue;
      if (ni.family === 'IPv4') ipv4.push(ni.address);
      else if (ni.family === 'IPv6' && !ni.address.startsWith('fe80')) ipv6.push(ni.address);
    }
  }
  return { ipv4, ipv6, hostname: hostname() };
});

ipcMain.handle('get-network-info', async () => {
  try {
    const out = await runPowerShell('netsh wlan show interfaces');
    const ssid = out.match(/^\s*SSID\s*:\s*(.+)$/m)?.[1]?.trim();
    const signal = out.match(/(?:Signal|Signalst)[^:]*:\s*(.+)$/m)?.[1]?.trim();
    const type = out.match(/(?:Radio type|Funktyp)\s*:\s*(.+)$/m)?.[1]?.trim();
    let profiles: string[] = [];
    try {
      const pout = await runPowerShell('netsh wlan show profiles');
      profiles = Array.from(pout.matchAll(/(?:All User Profile|Alle Benutzerprofile?)\s*:\s*(.+)/g)).map(m => m[1].trim());
    } catch { /* ignore */ }
    return { ssid, signal, type, profiles };
  } catch {
    return { profiles: [] };
  }
});

ipcMain.handle('get-battery', async () => {
  try {
    const out = await runPowerShell('(Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress)');
    const trimmed = out.trim();
    if (!trimmed) return null;
    const data = JSON.parse(trimmed);
    const percent = Number(data.EstimatedChargeRemaining);
    if (isNaN(percent)) return null;
    return { percent, charging: Number(data.BatteryStatus) !== 1 };
  } catch {
    return null;
  }
});

ipcMain.handle('ping-host', async (_event, host: string) => {
  const safe = String(host || '').replace(/[^a-zA-Z0-9.\-:]/g, '').slice(0, 100);
  if (!safe) return { host: safe, output: 'Ungültiger Host' };
  return new Promise((resolve) => {
    execFile('ping', ['-n', '4', safe], { timeout: 12000, windowsHide: true }, (_err, stdout) => {
      const out = (stdout || '').toString();
      const avg = out.match(/(?:Average|Mittelwert)\s*=\s*(\d+\s*ms)/)?.[1];
      const loss = out.match(/\((\d+)%\s*(?:loss|Verlust)\)/)?.[1];
      resolve({ host: safe, avg, loss: loss ? loss + '%' : undefined, output: out.trim() || 'Keine Antwort' });
    });
  });
});

ipcMain.handle('dns-lookup', async (_event, host: string) => {
  const safe = String(host || '').trim();
  if (!safe) return { host: safe, addresses: [] };
  try {
    const res = await dns.promises.lookup(safe, { all: true });
    return { host: safe, addresses: res.map(r => r.address) };
  } catch {
    return { host: safe, addresses: [] };
  }
});

ipcMain.handle('run-speedtest', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  let pingMs = 0;
  try {
    const t0 = Date.now();
    await new Promise<void>((resolve, reject) => {
      https.get('https://speed.cloudflare.com/__down?bytes=0', res => { res.resume(); res.on('end', () => resolve()); }).on('error', reject);
    });
    pingMs = Date.now() - t0;
  } catch { /* ignore */ }

  const bytesTarget = 25 * 1024 * 1024;
  let downloadMbps = 0;
  try {
    downloadMbps = await new Promise<number>((resolve, reject) => {
      const start = Date.now();
      let received = 0;
      https.get(`https://speed.cloudflare.com/__down?bytes=${bytesTarget}`, res => {
        res.on('data', chunk => {
          received += chunk.length;
          const elapsed = (Date.now() - start) / 1000;
          if (elapsed > 0 && win && !win.isDestroyed()) {
            win.webContents.send('speedtest-progress', {
              phase: 'download',
              mbps: (received * 8) / elapsed / 1e6,
              progress: Math.min(100, (received / bytesTarget) * 100),
            });
          }
        });
        res.on('end', () => {
          const elapsed = (Date.now() - start) / 1000;
          resolve(elapsed > 0 ? (received * 8) / elapsed / 1e6 : 0);
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  } catch { /* ignore */ }

  return { downloadMbps: Math.round(downloadMbps * 10) / 10, pingMs };
});

// ========================
// GLOBAL HOTKEY (customizable) & WINDOW SIZING
// ========================
ipcMain.handle('set-global-hotkey', async (_event, accelerator: string) => {
  return registerToggleHotkey(accelerator);
});

ipcMain.on('set-window-width', (_event, width: number) => {
  if (mainWindow) {
    const [, h] = mainWindow.getSize();
    const w = Math.max(420, Math.min(1400, Math.round(Number(width) || 750)));
    mainWindow.setSize(w, h);
    mainWindow.center();
  }
});

// ========================
// CLIPBOARD HISTORY MONITOR
// ========================
interface ClipEntry { type: 'text' | 'image'; value: string; ts: number; }
let clipHistory: ClipEntry[] = [];
let clipMonitorTimer: NodeJS.Timeout | null = null;
let lastClipText = '';
let lastClipImg = '';
const CLIP_MAX = 50;
const clipHistoryFile = () => join(app.getPath('userData'), 'clipboard-history.json');

function loadClipHistory(): void {
  try { clipHistory = JSON.parse(readFileSync(clipHistoryFile(), 'utf-8')); } catch { clipHistory = []; }
}
function saveClipHistory(): void {
  try { writeFileSync(clipHistoryFile(), JSON.stringify(clipHistory.slice(0, CLIP_MAX)), 'utf-8'); } catch { /* ignore */ }
}
function pollClipboard(): void {
  try {
    const text = clipboard.readText();
    if (text && text !== lastClipText) {
      lastClipText = text;
      clipHistory = [{ type: 'text' as const, value: text, ts: Date.now() }, ...clipHistory.filter(e => !(e.type === 'text' && e.value === text))].slice(0, CLIP_MAX);
      saveClipHistory();
      mainWindow?.webContents.send('clipboard-changed', clipHistory);
      return;
    }
    const img = clipboard.readImage();
    if (img && !img.isEmpty()) {
      const dataUrl = img.toDataURL();
      if (dataUrl !== lastClipImg && dataUrl.length < 3_000_000) {
        lastClipImg = dataUrl;
        clipHistory = [{ type: 'image' as const, value: dataUrl, ts: Date.now() }, ...clipHistory.filter(e => e.value !== dataUrl)].slice(0, CLIP_MAX);
        saveClipHistory();
        mainWindow?.webContents.send('clipboard-changed', clipHistory);
      }
    }
  } catch { /* ignore */ }
}

ipcMain.on('clipboard-monitor', (_event, enabled: boolean) => {
  if (enabled) {
    if (!clipHistory.length) loadClipHistory();
    lastClipText = clipboard.readText();
    if (!clipMonitorTimer) clipMonitorTimer = setInterval(pollClipboard, 1000);
  } else if (clipMonitorTimer) {
    clearInterval(clipMonitorTimer);
    clipMonitorTimer = null;
  }
});
ipcMain.handle('clipboard-history-get', async () => { if (!clipHistory.length) loadClipHistory(); return clipHistory; });
ipcMain.handle('clipboard-history-clear', async () => {
  clipHistory = [];
  saveClipHistory();
  mainWindow?.webContents.send('clipboard-changed', clipHistory);
  return true;
});
ipcMain.handle('clipboard-history-remove', async (_event, index: number) => {
  if (index >= 0 && index < clipHistory.length) {
    clipHistory.splice(index, 1);
    saveClipHistory();
    mainWindow?.webContents.send('clipboard-changed', clipHistory);
  }
  return true;
});

// ========================
// SYSTEM THEME (light/dark) for autoTheme
// ========================
ipcMain.handle('get-system-theme', async () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));
nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('system-theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});

// ========================
// PLUGIN SYSTEM
// ========================
// Plugin system is now handled by electron/utils/plugins.ts
// IPC handlers are registered via registerPluginIPC()

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

// ========================
// SYSTEM SETTINGS IPC
// ========================

// Get current system settings
ipcMain.handle('get-system-settings', () => {
  return { ...appSettings };
});

// ========================
// UPDATE CHECK IPC - Manual Download with electron's net
// ========================

// Helper: fetch JSON
async function fetchJSON(url: string) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    request.setHeader('User-Agent', 'WindowsBar-Updater/1.0');
    request.setHeader('Accept', 'application/vnd.github+json');
    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { 
          console.log('[WindowsBar] Raw response:', data.substring(0, 200));
          reject(new Error('Invalid JSON')); 
        }
      });
    });
    request.on('error', (e) => {
      console.log('[WindowsBar] Network error:', e.message);
      reject(e);
    });
    request.end();
  });
}

// Manual download helper - downloads file to temp folder
async function downloadAndInstall(url: string, version: string): Promise<void> {
  const path = join(app.getPath('temp'), `WindowsBar-${version}-Setup-NEU.exe`);
  const fs2 = require('fs');
  
  console.log(`[WindowsBar] Downloading to: ${path}`);
  console.log(`[WindowsBar] URL: ${url}`);
  
  return new Promise((resolve, reject) => {
    // Determine module to use based on protocol to completely bypass Chromium throttling
    const client = url.startsWith('https') ? require('https') : require('http');
    
    const download = (downloadUrl: string) => {
      client.get(downloadUrl, (response: any) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`[WindowsBar] Redirecting to: ${response.headers.location}`);
          return download(response.headers.location);
        }

        console.log(`[WindowsBar] Response status: ${response.statusCode}`);
        const total = parseInt(response.headers['content-length']?.toString() || '0');
        console.log(`[WindowsBar] Total size: ${total} bytes`);
        
        const writer = fs2.createWriteStream(path);
        let received = 0;
        
        response.on('data', (chunk: any) => {
          received += chunk.length;
          currentDownloadProgress = total > 0 ? (received / total) * 100 : 0;
          if (mainWindow) mainWindow.webContents.send('update-progress', currentDownloadProgress);
        });
        
        response.pipe(writer);
        
        writer.on('finish', () => {
          console.log('[WindowsBar] Download complete!');
          updateExePath = path;
          updateReady = true;
          isDownloading = false;
          currentDownloadProgress = 100;
          if (mainWindow) {
            mainWindow.webContents.send('update-downloaded');
            mainWindow.webContents.send('update-ready');
          }
          if (installOnReady) {
            console.log('[WindowsBar] installOnReady flag is true, launching installer now...');
            try {
              const { spawn } = require('child_process');
              const subprocess = spawn(updateExePath, ['/S', '/NCRC', '--force-run'], { detached: true, stdio: 'ignore' });
              subprocess.unref();
              app.quit();
            } catch (e) {
              console.error('[WindowsBar] Error launching auto-installer:', e);
            }
          }
          resolve();
        });

        writer.on('error', (err: any) => {
          console.error('[WindowsBar] Writer error:', err);
          reject(err);
        });
      }).on('error', (e: any) => {
        console.log('[WindowsBar] Network error:', e.message);
        reject(e);
      });
    };

    download(url);
  });
}

// Manual update check - direct GitHub API + manual download
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { available: false, currentVersion: app.getVersion(), error: 'Dev mode' };
  }

  const currentVersion = app.getVersion();
  console.log(`[WindowsBar] Check updates. Current: ${currentVersion}`);

  if (updateReady) {
    return { available: true, currentVersion, downloaded: true };
  }

  if (isDownloading) {
    return { available: true, currentVersion, downloaded: false, downloadProgress: currentDownloadProgress };
  }

  try {
    console.log('[WindowsBar] Fetching GitHub API...');
    const release: any = await fetchJSON('https://api.github.com/repos/JackyWein/Windows-Bar/releases/latest');
    console.log('[WindowsBar] Got release:', release?.tag_name, release?.name);
    
    const latestVersion = release.tag_name?.replace('v', '') || release.name;
    console.log(`[WindowsBar] Latest: ${latestVersion}, Current: ${currentVersion}`);
    
    // Compare versions properly
    const curr = currentVersion.split('.').map(Number);
    const latest = latestVersion.split('.').map(Number);
    const needsUpdate = latest[0] > curr[0] || (latest[0] === curr[0] && latest[1] > curr[1]) || (latest[0] === curr[0] && latest[1] === curr[1] && latest[2] > curr[2]);
    
    console.log(`[WindowsBar] Needs update: ${needsUpdate}, curr=${curr}, latest=${latest}`);
    
    if (needsUpdate) {
      const asset = release.assets?.find((a: any) => a.name?.endsWith('.exe') && a.name.includes('Setup'));
      console.log('[WindowsBar] Asset found:', asset?.name, asset?.browser_download_url);
      
      if (asset) {
        console.log(`[WindowsBar] Found: ${asset.name}, URL: ${asset.browser_download_url}`);
        isDownloading = true;
        // Start manual download
        downloadAndInstall(asset.browser_download_url, latestVersion).catch(e => {
          console.error('[WindowsBar] DL Error:', e);
          isDownloading = false;
        });
        
return {
          available: true,
          currentVersion,
          latestVersion,
          releaseNotes: release.body,
          downloaded: false,
          downloadProgress: 0,
        };
      }
    }
    
    return { available: false, currentVersion };
  } catch (error) {
    console.error('[WindowsBar] ERROR:', error);
    return { available: false, currentVersion, error: String(error) };
  }
});

// Installiere das Update
ipcMain.on('install-update', async () => {
  console.log('[WindowsBar] Install clicked!');
  
  if (!updateReady) {
    console.log('[WindowsBar] No update ready, setting installOnReady flag');
    installOnReady = true;
    return;
  }
  
  if (updateExePath) {
    try {
      console.log(`[WindowsBar] Installer: ${updateExePath}`);
      
      // Execute the installer silently and quit the app
      const { spawn } = require('child_process');
      const subprocess = spawn(updateExePath, ['/S', '/NCRC', '--force-run'], {
        detached: true,
        stdio: 'ignore'
      });
      subprocess.unref();
      
      console.log('[WindowsBar] Installer launched, quitting app...');
      app.quit();
    } catch (e) {
      console.error('[WindowsBar] Error launching auto-installer:', e);
    }
  } else {
    // Fallback: If we don't have the path exactly, look in temp dir
    const tempDir = app.getPath('temp');
    try {
      const files = await fs.readdir(tempDir);
      console.log('[WindowsBar] Files in temp:', files.filter(f => f.includes('WindowsBar')));
      
      const installer = files.find(f => f.includes('WindowsBar') && f.endsWith('.exe'));
      
      if (installer) {
        const exePath = join(tempDir, installer);
        console.log(`[WindowsBar] Installer (fallback): ${exePath}`);
        
        const { spawn } = require('child_process');
        const subprocess = spawn(exePath, ['/S', '/NCRC', '--force-run'], {
          detached: true,
          stdio: 'ignore'
        });
        subprocess.unref();
        
        console.log('[WindowsBar] Installer launched, quitting app...');
        app.quit();
      } else {
        console.log('[WindowsBar] No installer found');
        shell.openPath(tempDir);
      }
    } catch (e) {
      console.error('[WindowsBar] Error:', e);
    }
  }
});

// App-Version abrufen
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
// Update system settings from renderer
ipcMain.on('update-system-settings', (_event, settings: { autoStart?: boolean; alwaysOnTop?: boolean; overlayFullscreen?: boolean }) => {
  console.log('[WindowsBar] Updating system settings:', settings);

  // Update auto-start
  if (settings.autoStart !== undefined) {
    appSettings.autoStart = settings.autoStart;
    if (!isDev) {
      app.setLoginItemSettings({ openAtLogin: settings.autoStart, path: app.getPath('exe') });
    }
    console.log(`[WindowsBar] Auto-start ${settings.autoStart ? 'enabled' : 'disabled'}`);
  }

  // Update always-on-top
  if (settings.alwaysOnTop !== undefined) {
    appSettings.alwaysOnTop = settings.alwaysOnTop;
    if (mainWindow) {
      if (settings.alwaysOnTop) {
        // If overlay mode is also enabled, use screen-saver level
        if (appSettings.overlayFullscreen) {
          mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        } else {
          mainWindow.setAlwaysOnTop(true, 'floating', 1);
        }
      } else {
        mainWindow.setAlwaysOnTop(false);
      }
      console.log(`[WindowsBar] Always-on-top ${settings.alwaysOnTop ? 'enabled' : 'disabled'}`);
    }
  }

  // Update overlay fullscreen mode
  if (settings.overlayFullscreen !== undefined) {
    appSettings.overlayFullscreen = settings.overlayFullscreen;
    if (mainWindow) {
      if (settings.overlayFullscreen) {
        // 'screen-saver' level appears over fullscreen apps and games
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      } else if (appSettings.alwaysOnTop) {
        // Fall back to normal always-on-top if enabled
        mainWindow.setAlwaysOnTop(true, 'floating', 1);
      } else {
        mainWindow.setAlwaysOnTop(false);
      }
      console.log(`[WindowsBar] Overlay fullscreen ${settings.overlayFullscreen ? 'enabled' : 'disabled'}`);
    }
  }
});

// ========================
// PERSISTENT DATA STORAGE
// ========================

ipcMain.on('read-data-sync', (event, key: string) => {
  try {
    const filePath = join(app.getPath('userData'), `${key}.json`);
    const data = readFileSync(filePath, 'utf-8');
    event.returnValue = data;
  } catch {
    event.returnValue = null;
  }
});

ipcMain.on('write-data', (_event, key: string, data: string) => {
  try {
    const filePath = join(app.getPath('userData'), `${key}.json`);
    writeFileSync(filePath, data, 'utf-8');
  } catch (error) {
    console.error(`[WindowsBar] Error writing data for ${key}:`, error);
  }
});
