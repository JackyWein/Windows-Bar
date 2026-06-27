import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Theme, AppSettings } from '../types';
import { builtinThemes, getThemeById, applyTheme } from '../core/settings/themes';

// ========================
// Context Shape
// ========================

interface ThemeContextValue {
  readonly theme: Theme;
  readonly setTheme: (id: string) => void;
  readonly allThemes: readonly Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ========================
// Provider
// ========================

interface ThemeProviderProps {
  readonly children: React.ReactNode;
  readonly settings: AppSettings;
  readonly onThemeChange?: (themeId: string) => void;
}

function resolveTheme(settings: AppSettings): Theme {
  const found = getThemeById(settings.appearance.theme);
  return found ?? builtinThemes[0];
}

export function ThemeProvider({ children, settings, onThemeChange }: ThemeProviderProps): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme(settings));
  const prevThemeIdRef = useRef<string>(settings.appearance.theme);

  // When settings.appearance.theme changes externally, sync state
  useEffect(() => {
    const resolved = resolveTheme(settings);
    setThemeState(resolved);
    prevThemeIdRef.current = settings.appearance.theme;
  }, [settings.appearance.theme]);

  // Apply theme CSS variables whenever theme or settings blur/font change
  useEffect(() => {
    applyTheme(theme);
  }, [theme, settings.appearance.blur, settings.appearance.borderRadius, settings.appearance.fontSize, settings.appearance.fontFamily]);

  const setTheme = useCallback(
    (id: string) => {
      const found = getThemeById(id);
      if (!found) {
        return;
      }
      setThemeState(found);
      prevThemeIdRef.current = id;
      onThemeChange?.(id);
    },
    [onThemeChange]
  );

  const value: ThemeContextValue = {
    theme,
    setTheme,
    allThemes: builtinThemes,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
