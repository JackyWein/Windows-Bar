import { useState, useEffect, useCallback } from "react";
import type { AppSettings, ViewMode } from "./types";
import { defaultSettings } from "./types";
import { ThemeProvider } from "./components/ThemeProvider";
import { SearchView } from "./views/SearchView";
import { SettingsView } from "./views/SettingsView";
import { AiView } from "./views/AiView";
import { NotesView } from "./views/NotesView";
import { registerBuiltinCommands } from "./core/commands/builtin";
import { builtinThemes, getThemeById } from "./core/settings/themes";
import type { Theme } from "./types";
import type { AISettings } from "./core/ai";
import { useConfirm } from "./components/ConfirmDialog";
import "./index.css";

// Initialize command registry on app load
registerBuiltinCommands();

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

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("windowsbar_settings");
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const [viewMode, setViewMode] = useState<ViewMode>("search");
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [confirmDialog, confirm] = useConfirm();

  // Resolve current theme
  const theme: Theme =
    getThemeById(settings.appearance.theme) ?? builtinThemes[0];

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
        window.electronAPI.resizeWindow(750, 600);
      } catch { /* ignore */ }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("windowsbar_settings", JSON.stringify(settings));
  }, [settings]);

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

  const backToSearch = () => {
    setViewMode("search");
    try {
      window.electronAPI.resizeWindow(750, 600);
    } catch {
      /* ignore */
    }
  };

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
      {viewMode === "search" && (
        <SearchView
          settings={settings}
          onOpenAI={openAI}
          onOpenSettings={openSettings}
          onOpenNote={openNote}
        />
      )}
      {confirmDialog}
    </ThemeProvider>
  );
}

export default App;
