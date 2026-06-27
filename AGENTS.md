# Windows Bar — Agent Guide

> Read this first. It maps the codebase and lists the gotchas that will bite an agent.

## What it is
A premium Spotlight/Alfred-style search-bar replacement for Windows, built with Electron + React.
A global hotkey (default `Alt+Space`) summons a frameless, transparent overlay that does fuzzy
app/file/game search (custom indexer + optional Everything/Windows Search backends), runs a
slash-command system (calc, convert, web, weather, notes, clipboard, power, system, emoji), hosts a
multi-provider AI chat, an embedded media player (YouTube Music via plugin), notes, and settings.
Ships with a userData-based plugin system and a custom GitHub-Releases auto-updater.

## Tech stack (see `package.json`)
- **Electron** `^41.1.1`, **electron-builder** `^26.8.1`, **electron-updater** `^6.3.9` (NSIS, GitHub publish)
- **React** `19` + **TypeScript** `~5.9`, **Vite** `^8` with `vite-plugin-electron` (+ renderer plugin) — one Vite config builds main, preload, and renderer
- **lucide-react** (icons), **react-markdown** + **remark-gfm** (AI/markdown rendering)
- ESLint flat config (typescript-eslint, react-hooks, react-refresh)
- **fallow** static analysis is available (`fallow dead-code|dupes|health`, config in `.fallowrc.json`)

## Directory map

### `electron/` — main process (Node)
- **`main.ts`** — the monolith: window lifecycle, global hotkey, the custom file/app/game **indexer**
  (`buildIndex` scans Start Menu, Steam/Epic/Riot, user folders, drives; results cached to
  `userData/index-cache.json` and served via the `publishedIndex` snapshot), FS watchers, all `ipcMain`
  handlers, a PowerShell helper (`runPowerShell` via `-EncodedCommand` to avoid injection), system
  actions, the AI proxy, credential storage (`safeStorage`), and the auto-updater. Window is created
  with `preload: join(__dirname, 'preload.js')` (a **string path**, not an import).
- **`preload.ts`** — `contextBridge` exposes `window.electronAPI` + `window.pluginAPI`. Compiled
  separately to `dist-electron/preload.js`.
- **`utils/icons.ts`** — file/shortcut icon extraction (`tryGetIconWithRetry`, `resolveShortcutIcon`).
- **`utils/external-commands.ts`** — loads user `.js` command files from `userData/commands`.
- **`utils/plugins.ts`** — main-process plugin manager (install/list/load/uninstall, lifecycle, IPC via
  `registerPluginIPC`). Patches `Module._resolveFilename` so plugins can `require` the host's
  `node_modules`. Plugin IDs are regex-validated against path traversal.
- **`utils/sandbox.ts`** — `executeInSandbox` + `validateManifest`.
- **`indexers/everything.ts`** — voidtools Everything integration (`searchEverything`,
  `isEverythingRunning` — TTL-cached, do not call per keystroke).
- **`indexers/windowsSearch.ts`** — Windows Search index fallback.
- **`indexers/types.ts`** — shared `IndexItem` type.

### `src/` — renderer (React)
- **`main.tsx`** mounts `App` into `#root`.
- **`App.tsx`** — root orchestrator. Registers builtin commands, wires the plugin loader, global hotkey,
  clipboard monitor, system-theme follow, AI-key hydration, and media-plugin detection (`mediaPanel`
  manifest field → `mediaBus`). Owns `viewMode` routing (`search`/`settings`/`ai`/`notes`/`media-control`),
  settings persistence to `localStorage` (`windowsbar_settings`, API keys redacted → keychain), and
  `applyAllAppearance()` — **the single source of truth for all theme CSS variables**. Heavy views
  (Settings/AI/Notes/Media) are `React.lazy` + `Suspense` code-split; only `SearchView` is eager.
- **`views/`** — `SearchView`, `SettingsView`, `AiView`, `NotesView`, `views/ai/*` (chat UI).
- **`components/`** — `ThemeProvider`, `ConfirmDialog` (`useConfirm`), `MediaPanel` (chrome for the
  plugin-owned media `WebContentsView`), `CompactPlayer` (now-playing bar).
- **`core/commands/`** — the command system (see below).
- **`core/plugins/loader.ts`** — renderer plugin loader; mirrors plugin commands into the registry as
  `plugin:<id>:<cmd>`.
- **`core/ai/`** — provider-agnostic chat engine (`chat.ts`, `sessions.ts`, `providers/*` + `registry.ts`).
  `core/ai/index.ts` is the public barrel — import shared AI types/values from `./core/ai`.
- **`core/media/mediaBus.ts`** — singleton holding now-playing state + a controller fn.
- **`types.ts`** — shared renderer types (`Command`, `CommandContext`, `SearchResult`, `AppSettings`, …).
- **`preload.d.ts`** — the typed IPC contract (`window.electronAPI` + `window.pluginAPI`).
- **`styles/` + `index.css`** — global styles + CSS-variable theme tokens.

## Main ↔ renderer contract
Typed bridge declared in **`src/preload.d.ts`**, implemented in **`electron/preload.ts`**. Renderer calls
`invoke*` (request/response) or fire-and-forget; main pushes events via `on*` callbacks. Plugin result
objects carry functions as `{__plugin_action_id}` placeholders the loader rehydrates into
`() => pluginAPI.executeResultAction(id)`.

## Command system (`src/core/commands`)
- **`registry.ts`** — singleton `commandRegistry` (`Map<string, Command>`); `match(input)` returns the
  first enabled command whose `trigger` (string `startsWith` or `RegExp`) matches. Namespacing:
  external = `ext:`, plugin = `plugin:<id>:<cmd>`; `unregisterByPrefix` tears them down on disable.
- **Builtin commands** live in `core/commands/builtin/*` (calc, convert, text, web, weather, notes,
  clipboard, system, power, emoji), each a default-exported `Command[]`. **To add a command:** add it to
  the relevant builtin array (auto-registers via `builtin/index.ts`). If it needs OS access, add an
  `ipcMain.handle` in `electron/main.ts`, expose it in `electron/preload.ts`, type it in
  `src/preload.d.ts`, then call it via `ctx.api.<method>()` (`ctx.api` is `window.electronAPI`).

## Plugin system
- **Main (`electron/utils/plugins.ts`)** is the source of truth. Plugins live under
  `userData/plugins/<id>/` (`manifest.json` + optional `settings.json`). They can register command
  handlers, search providers, and main actions; `invokeMainAction(id, action, args)` calls a plugin's
  host-side `player.js`. A `mediaPanel` manifest field makes `App.tsx` render the media view backed by a
  plugin-owned Chromium `WebContentsView` (so real Google sign-in works). The separate plugin projects
  live in `D:\CODE\Windows-Bar-Plugins` (see that repo's `AGENTS.md`) — **do not vendor them here.**

## Build / release
- `npm run dev` → Vite HMR (main + preload + renderer). `npm run build` → `tsc && vite build &&
  electron-builder -p never` (NSIS installer to `dist/`). `npm run release[:patch|minor|major|none]` →
  `node scripts/release.js`.
- `scripts/release.js` bumps the version, builds, verifies the `.exe`/`latest.yml`/`.blockmap`, commits +
  tags `v<ver>`, pushes, extracts the matching `CHANGELOG.md` section, and creates/updates the GitHub
  Release via `gh`.
- Auto-updater: a custom GitHub-API flow in `main.ts` (`checkForUpdates`/`downloadAndInstall`) finds the
  latest release asset matching `*.exe` + `Setup`. It needs a **published (non-draft)** release.

## Gotchas (read before editing)
- **`tsc` in `npm run build` is effectively a no-op for type errors.** The real typecheck is
  **`npx tsc -b`** (project references). Always run it after changes.
- **Preload is loaded by path string**, not imported — fallow/static tools can't see it (declared in
  `.fallowrc.json` `dynamicallyLoaded`). If you change the contract, edit `electron/preload.ts` AND
  `src/preload.d.ts` and rebuild so `dist-electron/preload.js` exists; a stale/missing preload silently
  breaks `window.electronAPI`/`window.pluginAPI`.
- **`fallow dead-code` false positives to ignore:** the `ChatEngine` "unused class members" (called via
  `useRef(new ChatEngine())` in `AiView`, which fallow can't trace). Verify with grep before deleting any
  "unused" symbol — and `fallow dead-code --trace <file>:<sym>` for cross-module ones.
- **Full-height views must override the `.app-container` `padding-top: 12vh`** (the floating-search
  offset) to `0`, or their bottom/scroll-end is pushed off-screen. AI/media do this on their own
  wrappers; settings/notes are handled in `base.css`. The base `.search-glass` `max-height` must stay
  below `100vh - 12vh`.
- **Theming** goes through `applyAllAppearance()` in `App.tsx` only — don't set theme CSS vars elsewhere.
- **AI API keys** live in the OS keychain (`safeStorage`), redacted from the `localStorage` settings copy.
- **Do NOT cut a release without the user testing first** (project rule). `scripts/release.js` publishes a
  public GitHub Release — treat it as user-gated.
