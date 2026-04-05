import type { Theme, ThemeColors } from '../../types';

// ========================
// Built-in Theme Definitions
// ========================

const darkDefaultColors: ThemeColors = {
  bg: '#0f0f14',
  bgAlpha: 0.85,
  surface: 'rgba(255, 255, 255, 0.02)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f0f0f5',
  textMuted: '#6b6b80',
  accent: '#7c5cfc',
  accentHover: '#6a4ae0',
  app: '#7c5cfc',
  game: '#4ade80',
  file: '#60a5fa',
  web: '#fb923c',
  system: '#94a3b8',
};

const darkPurpleColors: ThemeColors = {
  bg: '#1a1025',
  bgAlpha: 0.88,
  surface: 'rgba(168, 85, 247, 0.04)',
  border: 'rgba(168, 85, 247, 0.12)',
  text: '#ede9fe',
  textMuted: '#7c6b99',
  accent: '#a855f7',
  accentHover: '#9333ea',
  app: '#a855f7',
  game: '#c084fc',
  file: '#818cf8',
  web: '#f0abfc',
  system: '#a78bfa',
};

const darkOceanColors: ThemeColors = {
  bg: '#0c1929',
  bgAlpha: 0.88,
  surface: 'rgba(56, 189, 248, 0.03)',
  border: 'rgba(56, 189, 248, 0.1)',
  text: '#e0f2fe',
  textMuted: '#5b8aa8',
  accent: '#38bdf8',
  accentHover: '#0ea5e9',
  app: '#38bdf8',
  game: '#2dd4bf',
  file: '#818cf8',
  web: '#fbbf24',
  system: '#94a3b8',
};

const lightDefaultColors: ThemeColors = {
  bg: '#ffffff',
  bgAlpha: 0.95,
  surface: 'rgba(0, 0, 0, 0.02)',
  border: 'rgba(0, 0, 0, 0.08)',
  text: '#1a1a2e',
  textMuted: '#6b7280',
  accent: '#6366f1',
  accentHover: '#4f46e5',
  app: '#6366f1',
  game: '#10b981',
  file: '#3b82f6',
  web: '#f59e0b',
  system: '#6b7280',
};

const lightWarmColors: ThemeColors = {
  bg: '#faf5ef',
  bgAlpha: 0.95,
  surface: 'rgba(180, 130, 70, 0.04)',
  border: 'rgba(180, 130, 70, 0.12)',
  text: '#3d2e1e',
  textMuted: '#8b7355',
  accent: '#c2854a',
  accentHover: '#a86e3a',
  app: '#c2854a',
  game: '#6d9b6d',
  file: '#5b8fb9',
  web: '#c47a5a',
  system: '#8b7355',
};

const nordColors: ThemeColors = {
  bg: '#2e3440',
  bgAlpha: 0.92,
  surface: 'rgba(216, 222, 233, 0.04)',
  border: 'rgba(216, 222, 233, 0.08)',
  text: '#eceff4',
  textMuted: '#4c566a',
  accent: '#88c0d0',
  accentHover: '#81a1c1',
  app: '#5e81ac',
  game: '#a3be8c',
  file: '#88c0d0',
  web: '#d08770',
  system: '#4c566a',
};

const draculaColors: ThemeColors = {
  bg: '#282a36',
  bgAlpha: 0.92,
  surface: 'rgba(255, 255, 255, 0.03)',
  border: 'rgba(255, 255, 255, 0.06)',
  text: '#f8f8f2',
  textMuted: '#6272a4',
  accent: '#bd93f9',
  accentHover: '#ff79c6',
  app: '#bd93f9',
  game: '#50fa7b',
  file: '#8be9fd',
  web: '#ffb86c',
  system: '#6272a4',
};

const catppuccinColors: ThemeColors = {
  bg: '#1e1e2e',
  bgAlpha: 0.92,
  surface: 'rgba(205, 214, 244, 0.04)',
  border: 'rgba(205, 214, 244, 0.08)',
  text: '#cdd6f4',
  textMuted: '#585b70',
  accent: '#cba6f7',
  accentHover: '#f5c2e7',
  app: '#cba6f7',
  game: '#a6e3a1',
  file: '#89b4fa',
  web: '#fab387',
  system: '#6c7086',
};

// ========================
// Theme Array
// ========================

export const builtinThemes: readonly Theme[] = [
  {
    id: 'dark-default',
    name: 'Dark Default',
    type: 'dark',
    colors: darkDefaultColors,
    blur: { enabled: true, amount: 40 },
    radius: 14,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
  {
    id: 'dark-purple',
    name: 'Dark Purple',
    type: 'dark',
    colors: darkPurpleColors,
    blur: { enabled: true, amount: 40 },
    radius: 14,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
  {
    id: 'dark-ocean',
    name: 'Ocean Blue',
    type: 'dark',
    colors: darkOceanColors,
    blur: { enabled: true, amount: 40 },
    radius: 14,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
  {
    id: 'light-default',
    name: 'Light',
    type: 'light',
    colors: lightDefaultColors,
    blur: { enabled: true, amount: 30 },
    radius: 14,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
  {
    id: 'light-warm',
    name: 'Warm Light',
    type: 'light',
    colors: lightWarmColors,
    blur: { enabled: true, amount: 30 },
    radius: 14,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
  {
    id: 'nord',
    name: 'Nord',
    type: 'dark',
    colors: nordColors,
    blur: { enabled: true, amount: 35 },
    radius: 12,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    colors: draculaColors,
    blur: { enabled: true, amount: 35 },
    radius: 12,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    type: 'dark',
    colors: catppuccinColors,
    blur: { enabled: true, amount: 35 },
    radius: 14,
    fontSize: 16,
    fontFamily: "'Inter', 'Segoe UI Variable', system-ui, sans-serif",
  },
] as const;

// ========================
// Theme Lookup
// ========================

export function getThemeById(id: string): Theme | undefined {
  return builtinThemes.find((theme) => theme.id === id);
}

// ========================
// CSS Variable Application
// ========================

/**
 * Applies a theme's colors and settings as CSS custom properties
 * on document.documentElement, matching the existing CSS variable
 * names used throughout index.css.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const { colors, blur, radius, fontSize, fontFamily } = theme;

  // Core background
  root.style.setProperty('--bg', `rgba(${hexToRgb(colors.bg)}, var(--bg-alpha))`);
  root.style.setProperty('--bg-alpha', colors.bgAlpha.toString());

  // Surface (used for subtle backgrounds)
  root.style.setProperty('--surface', colors.surface);

  // Border
  root.style.setProperty('--border', colors.border);

  // Text
  root.style.setProperty('--text', colors.text);
  root.style.setProperty('--text-muted', colors.textMuted);

  // Compute a dimmer text from textMuted for --text-dim
  const textDim = dimColor(colors.textMuted, 0.7);
  root.style.setProperty('--text-dim', textDim);

  // Accent
  root.style.setProperty('--accent', colors.accent);

  // Item states - derive from accent for selected, neutral for hover
  root.style.setProperty('--item-selected', `rgba(${hexToRgb(colors.accent)}, 0.15)`);
  const isDark = theme.type === 'dark';
  root.style.setProperty(
    '--item-hover',
    isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'
  );

  // Type-specific category colors
  root.style.setProperty('--green', colors.game);
  root.style.setProperty('--blue', colors.file);
  root.style.setProperty('--orange', colors.web);
  root.style.setProperty('--pink', colors.accent);

  // Layout
  root.style.setProperty('--radius', `${radius}px`);
  root.style.setProperty('--blur-amount', `${blur.enabled ? blur.amount : 0}px`);
  root.style.setProperty('--font-size-base', `${fontSize}px`);

  // Font family on body
  root.style.setProperty('font-family', fontFamily);
}

// ========================
// Helpers
// ========================

function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '');

  if (cleaned.length === 3) {
    const r = cleaned[0];
    const g = cleaned[1];
    const b = cleaned[2];
    return `${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}`;
  }

  const num = parseInt(cleaned, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

/**
 * Dims a color string (hex or rgba) by reducing opacity.
 * For hex colors, converts to rgba with the given alpha.
 */
function dimColor(color: string, alpha: number): string {
  const trimmed = color.trim();

  // Already rgba/rgb - just return as-is (can't easily dim further without parsing)
  if (trimmed.startsWith('rgba') || trimmed.startsWith('rgb')) {
    return trimmed;
  }

  // Hex color
  if (trimmed.startsWith('#')) {
    return `rgba(${hexToRgb(trimmed)}, ${alpha})`;
  }

  // Fallback: return as-is
  return trimmed;
}
