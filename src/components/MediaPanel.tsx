import { useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RotateCw, LogOut } from 'lucide-react';
import '../styles/media-control.css';

export interface MediaPanelConfig {
  pluginId: string;
  url: string;
  partition: string;
  name: string;
  userAgent?: string;
}

interface MediaPanelProps {
  config: MediaPanelConfig;
  onBack: () => void;
}

// Thin wrapper around a plugin-owned WebContentsView (real Chromium view, so
// Google sign-in works). This component only renders the chrome (header) and a
// placeholder; it tells the plugin where to position the view via getBoundingRect.
export function MediaPanel({ config, onBack }: MediaPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pid = config.pluginId;

  const pushBounds = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    window.pluginAPI?.invokeMainAction?.(pid, 'setBounds', { x: r.left, y: r.top, width: r.width, height: r.height });
  }, [pid]);

  useEffect(() => {
    // Position the embedded view over our placeholder (after layout settles).
    const t1 = setTimeout(pushBounds, 60);
    const t2 = setTimeout(pushBounds, 320);
    const onResize = () => pushBounds();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      // Hide the embedded view when leaving the panel (keeps playing in background).
      window.pluginAPI?.invokeMainAction?.(pid, 'setBounds', null);
    };
  }, [pid, pushBounds]);

  const reload = () => { window.pluginAPI?.invokeMainAction?.(pid, 'reload'); };
  const logout = () => { window.pluginAPI?.invokeMainAction?.(pid, 'logout'); };

  return (
    <div className="app-container media-app-container">
      <div className="search-glass media-panel-glass">
        <div className="ytm-header">
          <button className="ytm-back-btn" onClick={onBack}><ArrowLeft size={16} /><span>Zurück</span></button>
          <div className="ytm-header-center"><span className="ytm-title">{config.name}</span></div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="ytm-back-btn" onClick={reload} title="Neu laden"><RotateCw size={15} /></button>
            <button className="ytm-back-btn" onClick={logout} title="Abmelden / Konto wechseln"><LogOut size={15} /></button>
          </div>
        </div>
        <div className="media-webview-host" ref={hostRef}>
          <div className="media-webview-loading">Lade {config.name}…</div>
        </div>
      </div>
    </div>
  );
}
