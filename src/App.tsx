import { useState, useEffect, useCallback, useRef, lazy, Suspense, Component } from "react";
import type { ReactNode } from "react";
import type { AppSettings, ViewMode } from "./types";
import { defaultSettings } from "./types";
import { ThemeProvider } from "./components/ThemeProvider";
import { SearchView } from "./views/SearchView";
import type { MediaPanelConfig } from "./components/MediaPanel";
import { mediaBus } from "./core/media/mediaBus";
import { registerBuiltinCommands } from "./core/commands/builtin";
import { initExternalCommands } from "./core/commands/external-loader";
import { initPluginLoader } from "./core/plugins/loader";
import { builtinThemes, getThemeById } from "./core/settings/themes";
import type { Theme } from "./types";
import type { AISettings, ProviderConfig } from "./core/ai";
import { useConfirm } from "./components/ConfirmDialog";
import "./index.css";

// Heavy panels are code-split so the initial bundle only contains what's needed to
// paint the search box; Vite splits each dynamic import into its own chunk that loads
// the first time the view is opened.
const SettingsView = lazy(() => import("./views/SettingsView").then((m) => ({ default: m.SettingsView })));
const AiView = lazy(() => import("./views/AiView").then((m) => ({ default: m.AiView })));
const NotesView = lazy(() => import("./views/NotesView").then((m) => ({ default: m.NotesView })));
const MediaPanel = lazy(() => import("./components/MediaPanel").then((m) => ({ default: m.MediaPanel })));

// Initialize command registry on app load
registerBuiltinCommands();
initExternalCommands();

/**
 * Applies ALL appearance settings as CSS variables.
 * This is the single source of truth - no other place should set CSS vars.
 */
function applyAllAppearance(settings: AppSettings, theme: Theme): void {
  const root = document.documentElement;
  const c = theme.colors;

  // Background
  root.style.setProperty("--bg", `rgba(${hexToRgb(c.bg)}, var(--bg-alpha))`);
  root.style.setProperty("--bg-alpha", String(c.bgAlpha));
  root.style.setProperty("--surface", c.surface);
  root.style.setProperty("--border", c.border);

  // Text
  root.style.setProperty("--text", c.text);
  root.style.setProperty("--text-muted", c.textMuted);
  root.style.setProperty("--text-dim", dimColor(c.textMuted, 0.7));

  // Accent (user override takes priority over theme)
  root.style.setProperty("--accent", settings.appearance.accentColor);
  root.style.setProperty("--accent-rgb", hexToRgb(settings.appearance.accentColor));
  root.style.setProperty(
    "--item-selected",
    `rgba(${hexToRgb(settings.appearance.accentColor)}, 0.15)`,
  );
  const isDark = theme.type === "dark";
  root.style.setProperty(
    "--item-hover",
    isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
  );

  // Type-specific colors
  root.style.setProperty("--green", c.game);
  root.style.setProperty("--blue", c.file);
  root.style.setProperty("--orange", c.web);
  root.style.setProperty("--pink", c.accent);

  // Layout - borderRadius from settings, not theme (user can override)
  root.style.setProperty("--radius", `${settings.appearance.borderRadius}px`);

  // Blur - from settings (user controls amount + enabled)
  const blurAmount = settings.appearance.blur.enabled ? settings.appearance.blur.amount : 0;
  root.style.setProperty("--blur-amount", `${blurAmount}px`);
  root.style.setProperty("--blur-enabled", settings.appearance.blur.enabled ? "1" : "0");
  
  // Apply no-blur class via CSS - more reliable than DOM manipulation
  if (settings.appearance.blur.enabled && blurAmount > 0) {
    root.classList.remove('no-blur');
  } else {
    root.classList.add('no-blur');
  }

  // Font size - from settings (now in pixels)
  root.style.setProperty(
    "--font-size-base",
    `${settings.appearance.fontSize}px`,
  );

  // Font family - from settings, fallback to theme
  root.style.setProperty(
    "font-family",
    settings.appearance.fontFamily || theme.fontFamily,
  );

  // Transparency
  root.style.setProperty(
    "--bg-alpha",
    String(settings.appearance.transparency / 100),
  );

  // Animations/transition speed
  root.style.setProperty(
    "--transition-speed",
    settings.appearance.animations ? "0.15s" : "0s",
  );
  if (settings.appearance.animations) root.classList.remove("no-anim");
  else root.classList.add("no-anim");

  // Scrollbar visibility - apply to scrollable containers
  const showScrollbar = settings.appearance.showScrollbar;
  const scrollbarStyle = document.createElement("style");
  scrollbarStyle.id = "scrollbar-visibility";
  scrollbarStyle.textContent = showScrollbar
    ? "/* scrollbar visible */"
    : `.results-container::-webkit-scrollbar, .settings-content::-webkit-scrollbar { display: none; }
       .results-container, .settings-content { scrollbar-width: none; }`;
  const existing = document.getElementById("scrollbar-visibility");
  if (existing) existing.remove();
  document.head.appendChild(scrollbarStyle);

  // Compact mode - reduced padding/gaps
  root.style.setProperty(
    "--compact-padding",
    settings.appearance.compactMode ? "4px 8px" : "10px 14px",
  );
  root.style.setProperty(
    "--compact-gap",
    settings.appearance.compactMode ? "0px" : "2px",
  );
  root.style.setProperty(
    "--compact-font-size",
    settings.appearance.compactMode ? "0.85em" : "1em",
  );
  root.style.setProperty(
    "--compact-item-height",
    settings.appearance.compactMode ? "32px" : "44px",
  );
  root.style.setProperty(
    "--compact-icon-size",
    settings.appearance.compactMode ? "18px" : "24px",
  );
  root.style.setProperty(
    "--compact-search-padding",
    settings.appearance.compactMode ? "10px 14px" : "14px 18px",
  );

  // Font size from settings
  root.style.setProperty("--font-size-base", `${settings.appearance.fontSize}px`);
}

function hexToRgb(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    return `${parseInt(cleaned[0] + cleaned[0], 16)}, ${parseInt(cleaned[1] + cleaned[1], 16)}, ${parseInt(cleaned[2] + cleaned[2], 16)}`;
  }
  const num = parseInt(cleaned, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function dimColor(color: string, alpha: number): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("rgba") || trimmed.startsWith("rgb")) return trimmed;
  if (trimmed.startsWith("#")) return `rgba(${hexToRgb(trimmed)}, ${alpha})`;
  return trimmed;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
// Deep-merge persisted settings over defaults so a partial/older saved object never
// leaves a nested field (e.g. appearance.blur.enabled) undefined — that used to throw
// inside applyAllAppearance and white-screen the whole app.
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : override) as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = deepMerge((base as Record<string, unknown>)[k], (override as Record<string, unknown>)[k]);
  }
  return out as T;
}

// Recovers from a failed lazy-chunk load (e.g. a stale index.html after an auto-update
// references a renamed chunk, or AV quarantine) instead of unmounting to a white screen.
class ViewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error("[WindowsBar] View failed to load:", err); }
  render() {
    if (this.state.failed) {
      return (
        <div className="app-container">
          <div className="search-glass" style={{ padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
            <span>Ansicht konnte nicht geladen werden.</span>
            <button className="settings-btn" onClick={() => location.reload()}>Neu laden</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("windowsbar_settings");
    if (saved) {
      try {
        return deepMerge(defaultSettings, JSON.parse(saved));
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const [viewMode, setViewMode] = useState<ViewMode>("search");
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [mediaConfig, setMediaConfig] = useState<MediaPanelConfig | null>(null);
  const [showMediaBar, setShowMediaBar] = useState(true);
  const [confirmDialog, confirm] = useConfirm();

  // Keep the configured search-window width available to event handlers.
  const widthRef = useRef(settings.appearance.windowWidth || 750);
  widthRef.current = settings.appearance.windowWidth || 750;

  // Resolve current theme (built-in + user-created custom themes)
  const theme: Theme =
    (settings.appearance.customThemes ?? []).find((t) => t.id === settings.appearance.theme) ??
    getThemeById(settings.appearance.theme) ??
    builtinThemes[0];

  // SINGLE source of truth: apply all appearance settings whenever anything changes
  useEffect(() => {
    applyAllAppearance(settings, theme);
  }, [settings, theme]);

  // Reset to search view when the app window gains focus (e.g. after Alt+Space hide/show)
  useEffect(() => {
    const handleFocus = () => {
      setViewMode('search');
      setActiveNoteId(null);
      try {
        window.electronAPI.resizeWindow(widthRef.current, 600);
      } catch { /* ignore */ }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Initialize plugin loader (registers plugin commands into commandRegistry)
  useEffect(() => {
    initPluginLoader(
      (view) => setViewMode(view as ViewMode),
      () => {} // Plugin results are handled via commands, not direct injection
    );
  }, []);

  // Persist settings — AI API keys are stored in the encrypted OS keychain
  // (safeStorage) and redacted from the localStorage copy.
  useEffect(() => {
    const safeProviders: Record<string, ProviderConfig> = {};
    for (const [id, cfg] of Object.entries(settings.ai.providers)) {
      if (cfg.apiKey) {
        window.electronAPI?.storeCredential?.(`ai:${id}`, cfg.apiKey).catch(() => {});
        safeProviders[id] = { ...cfg, apiKey: undefined };
      } else {
        safeProviders[id] = cfg;
      }
    }
    const toSave = { ...settings, ai: { ...settings.ai, providers: safeProviders } };
    try {
      localStorage.setItem("windowsbar_settings", JSON.stringify(toSave));
    } catch (e) {
      console.error("[WindowsBar] Failed to persist settings:", e);
    }
  }, [settings]);

  // Hydrate AI API keys from the encrypted keychain on startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const providers = settings.ai.providers;
      const ids = Object.keys(providers);
      if (ids.length === 0) return;
      let changed = false;
      const hydrated: Record<string, ProviderConfig> = {};
      for (const id of ids) {
        const cfg = providers[id];
        if (!cfg.apiKey) {
          try {
            const k = await window.electronAPI?.getCredential?.(`ai:${id}`);
            if (k) { hydrated[id] = { ...cfg, apiKey: k }; changed = true; continue; }
          } catch { /* ignore */ }
        }
        hydrated[id] = cfg;
      }
      if (changed && !cancelled) {
        setSettings((prev) => ({ ...prev, ai: { ...prev.ai, providers: hydrated } }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register the (customizable) global hotkey.
  useEffect(() => {
    const hk = settings.shortcuts?.toggle || "Alt+Space";
    window.electronAPI?.setGlobalHotkey?.(hk).catch(() => {});
  }, [settings.shortcuts?.toggle]);

  // Start/stop the real clipboard-history monitor.
  useEffect(() => {
    const enabled = settings.features.clipboardHistory && settings.privacy.saveClipboardHistory;
    window.electronAPI?.startClipboardMonitor?.(!!enabled);
  }, [settings.features.clipboardHistory, settings.privacy.saveClipboardHistory]);

  // Apply the configured search-window width when it changes.
  useEffect(() => {
    if (viewMode === "search") {
      try { window.electronAPI.resizeWindow(settings.appearance.windowWidth || 750, 600); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.appearance.windowWidth]);

  // Size the window for whichever view is active (covers plugin-triggered navigation, e.g. /music).
  useEffect(() => {
    try {
      if (viewMode === "search") window.electronAPI.resizeWindow(settings.appearance.windowWidth || 750, 600);
      else if (viewMode === "media-control") window.electronAPI.resizeWindow(1000, 720);
      else window.electronAPI.resizeWindow(850, 700);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Detect a media-panel plugin (e.g. YouTube Music) from installed plugin manifests.
  const detectMedia = useCallback(async () => {
    try {
      const list = await window.pluginAPI?.list?.();
      if (!list) return;
      for (const p of list as Array<{ id: string; name: string }>) {
        const pid = String(p.id);
        if (settings.plugins?.enabled?.[pid] === false) continue;
        const manifest = (await window.pluginAPI.getManifest(pid)) as
          | { mediaPanel?: { url?: string; partition?: string; name?: string; userAgent?: string } }
          | null;
        const mp = manifest?.mediaPanel;
        if (mp?.url) {
          setMediaConfig({
            pluginId: pid,
            url: mp.url,
            partition: mp.partition || "persist:media",
            name: mp.name || p.name,
            userAgent: mp.userAgent,
          });
          // Apply the plugin's own settings (now-playing bar + API server/port).
          try {
            const ps = (await window.pluginAPI.getSettings(pid)) as
              | { showNowPlayingBar?: boolean; apiEnabled?: boolean; apiPort?: number }
              | undefined;
            setShowMediaBar(ps?.showNowPlayingBar !== false);
            window.pluginAPI
              .invokeMainAction(pid, "configure", { apiEnabled: ps?.apiEnabled !== false, apiPort: Number(ps?.apiPort) || 26538 })
              .catch(() => {});
          } catch { /* ignore */ }
          return;
        }
      }
      setMediaConfig(null);
    } catch { /* ignore */ }
  }, [settings.plugins?.enabled]);

  useEffect(() => {
    detectMedia();
    const t = setTimeout(detectMedia, 2500); // retry after plugins finish loading
    const onFocus = () => detectMedia();
    window.addEventListener("focus", onFocus);
    window.pluginAPI?.onPluginSettingsUpdated?.(() => detectMedia());
    return () => {
      clearTimeout(t);
      window.removeEventListener("focus", onFocus);
      window.pluginAPI?.removePluginSettingsListeners?.();
    };
  }, [detectMedia]);

  // Poll the active media plugin for now-playing state (drives the compact bar).
  useEffect(() => {
    if (!mediaConfig) { mediaBus.reset(); return; }
    let cancelled = false;
    const poll = async () => {
      try {
        const st = (await window.pluginAPI.invokeMainAction(mediaConfig.pluginId, "getState")) as
          | { isPlaying?: boolean; currentTrack?: { title: string; artist: string; album?: string; artwork?: string } | null; volume?: number; currentTime?: number; duration?: number; likeStatus?: string }
          | null;
        if (cancelled || !st) return;
        mediaBus.set({
          isPlaying: !!st.isPlaying,
          track: st.currentTrack || null,
          volume: typeof st.volume === "number" ? st.volume : 100,
          currentTime: st.currentTime || 0,
          duration: st.duration || 0,
          likeStatus: st.likeStatus || "",
        });
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [mediaConfig]);

  // Route media controls to the plugin always (so the compact bar's buttons work
  // even when the full player view was never opened).
  useEffect(() => {
    if (!mediaConfig) { mediaBus.setController(null); return; }
    const pid = mediaConfig.pluginId;
    mediaBus.setController((action, value) => {
      window.pluginAPI?.invokeMainAction?.(pid, "control", { action, value });
    });
    return () => mediaBus.setController(null);
  }, [mediaConfig]);

  // Auto-follow the Windows light/dark preference when enabled.
  useEffect(() => {
    if (!settings.appearance.autoTheme) return;
    const apply = (sys: "light" | "dark") => {
      const targetId = sys === "dark" ? "dark-default" : "light-default";
      setSettings((prev) =>
        prev.appearance.theme === targetId
          ? prev
          : { ...prev, appearance: { ...prev.appearance, theme: targetId } },
      );
    };
    window.electronAPI?.getSystemTheme?.().then(apply).catch(() => {});
    window.electronAPI?.onSystemThemeChange?.(apply);
    return () => { window.electronAPI?.removeSystemThemeListeners?.(); };
  }, [settings.appearance.autoTheme]);

  const updateSetting = useCallback(
    (category: keyof AppSettings, key: string, value: unknown) => {
      setSettings((prev) => ({
        ...prev,
        [category]: { ...prev[category], [key]: value },
      }));
    },
    [],
  );

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.setItem(
      "windowsbar_settings",
      JSON.stringify(defaultSettings),
    );
  };

  const openAI = () => {
    setViewMode("ai");
    try {
      window.electronAPI.resizeWindow(850, 700);
    } catch {
      /* ignore */
    }
  };

  const backToSearch = useCallback(() => {
    setViewMode("search");
    try {
      window.electronAPI.resizeWindow(widthRef.current, 600);
    } catch {
      /* ignore */
    }
  }, []);

  // Global Escape handler: go back to search from any view (but not when modals are open)
  useEffect(() => {
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.modal-backdrop, .confirm-backdrop')) return;
      if (viewMode !== 'search') {
        e.preventDefault();
        backToSearch();
      }
    };
    window.addEventListener('keydown', handleGlobalEscape);
    return () => window.removeEventListener('keydown', handleGlobalEscape);
  }, [viewMode, backToSearch]);

  const updateAiSettings = useCallback((aiSettings: AISettings) => {
    setSettings((prev) => ({ ...prev, ai: aiSettings }));
  }, []);

  const openSettings = () => {
    setViewMode("settings");
    try {
      window.electronAPI.resizeWindow(850, 700);
    } catch {
      /* ignore */
    }
  };

  const openNote = (id?: number) => {
    if (id !== undefined) setActiveNoteId(id);
    else setActiveNoteId(null);
    setViewMode("notes");
    try {
      window.electronAPI.resizeWindow(850, 700);
    } catch {
      /* ignore */
    }
  };

  const openMediaControl = () => {
    setViewMode("media-control");
    try {
      window.electronAPI.resizeWindow(850, 700);
    } catch {
      /* ignore */
    }
  };

  const clearAllData = async () => {
    const ok = await confirm({
      title: "Delete All Data",
      message: "Möchtest du wirklich alle Daten löschen?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) {
      localStorage.clear();
      if (window.electronAPI?.writeData) {
        window.electronAPI.writeData("windowsbar_settings", JSON.stringify(defaultSettings));
        window.electronAPI.writeData("windowsbar_notes", "[]");
        window.electronAPI.writeData("windowsbar_clipboard_history", "[]");
      }
      setSettings(defaultSettings);
    }
  };

  // ThemeProvider wraps ALL views so settings changes are reflected everywhere
  return (
    <ThemeProvider
      settings={settings}
      onThemeChange={(themeId) => updateSetting("appearance", "theme", themeId)}
    >
      <ViewErrorBoundary>
      <Suspense fallback={null}>
      {viewMode === "ai" && (
        <AiView
          settings={settings.ai}
          onSettingsChange={updateAiSettings}
          onBack={backToSearch}
        />
      )}
      {viewMode === "settings" && (
        <SettingsView
          settings={settings}
          onBack={backToSearch}
          onUpdateSetting={updateSetting}
          onReset={resetSettings}
          onClearData={clearAllData}
        />
      )}
      {viewMode === "notes" && (
        <NotesView
          settings={settings}
          onBack={backToSearch}
          initialNoteId={activeNoteId}
        />
      )}
      {/* The actual web player lives in a plugin-owned WebContentsView (real
          Chromium → Google sign-in works). It persists in the background; this
          panel just renders the chrome and positions the view. */}
      {viewMode === "media-control" && mediaConfig && (
        <MediaPanel config={mediaConfig} onBack={backToSearch} />
      )}
      {viewMode === "search" && (
        <SearchView
          settings={settings}
          onOpenAI={openAI}
          onOpenSettings={openSettings}
          onOpenNote={openNote}
          onOpenMediaControl={openMediaControl}
          hasMedia={!!mediaConfig}
          showMediaBar={showMediaBar}
        />
      )}
      </Suspense>
      </ViewErrorBoundary>
      {confirmDialog}
    </ThemeProvider>
  );
}

export default App;
