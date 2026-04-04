import React, { useState, useEffect, useRef } from 'react';
import { Search, File, AppWindow, Gamepad2, Bot, Globe, Calculator, ArrowLeft, ExternalLink, Settings, TerminalSquare, Send, CloudRain } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import './index.css';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'app' | 'file' | 'game' | 'ai' | 'web' | 'system' | 'weather' | 'calc';
  path?: string;
  isWeb?: boolean;
  iconBase64?: string;
  isExpandBtn?: boolean;
}

type ViewMode = 'search' | 'ai';

const api = () => (window as any).electronAPI;

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [terminalInput, setTerminalInput] = useState('');
  const [expandWeb, setExpandWeb] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const focusFn = () => {
      if (viewMode !== 'search') return;
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    };
    window.addEventListener('focus', focusFn);
    return () => window.removeEventListener('focus', focusFn);
  }, [viewMode]);

  // Switch to AI mode (Native CLI)
  const openAI = () => {
    setViewMode('ai');
    try { api()?.resizeWindow(850, 700); } catch(e) {}
    try { api()?.startTerminal(); } catch(e) {}
    
    // Focus terminal input shortly after
    setTimeout(() => {
      terminalInputRef.current?.focus();
    }, 300);
  };

  // Back to search mode
  const backToSearch = () => {
    if (viewMode === 'ai') {
      try { api()?.stopTerminal(); } catch(e) {}
    }
    setViewMode('search');
    try { api()?.resizeWindow(750, 600); } catch(e) {}
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    setSelectedIndex(0);
    setExpandWeb(false);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    // /ai command
    if (query.trim() === '/ai' || query.startsWith('/ai ')) {
      setResults([{
        id: 'ai',
        title: 'Google Gemini öffnen',
        subtitle: 'KI-Chat direkt hier starten',
        type: 'ai'
      }]);
      return;
    }

    // /g command (Instant Answers & Web Search)
    if (query.startsWith('/g ')) {
      setLoading(true);
      const term = query.substring(3);
      const fetchWeb = async () => {
        try {
          const raw = await api()?.fetchInstantAnswer(term);
          if (raw) {
            setResults(raw.map((item: any, idx: number) => ({
              id: `w-${idx}`, ...item
            })));
          }
        } catch(e) {}
        setLoading(false);
      };
      const t = setTimeout(fetchWeb, 300);
      return () => clearTimeout(t);
    }

    setLoading(true);
    const fetchLocal = async () => {
      try {
        const raw = await api()?.searchEverything(query);
        const mappedLocal: SearchResult[] = (raw || []).map((item: any, idx: number) => ({
          id: `r-${idx}`,
          title: item.title.replace(/\.(lnk|url)$/i, ''),
          subtitle: item.path,
          type: (['game', 'app', 'system'].includes(item.type) ? item.type : 'file') as SearchResult['type'],
          path: item.path,
          iconBase64: item.iconBase64
        }));
        
        setResults(mappedLocal);
        setLoading(false);

        // Implicitly try to fetch Instant Answers if not /ai
        if (query.trim().length >= 2 && !query.startsWith('/ai')) {
          api()?.fetchInstantAnswer(query).then((webRaw: any) => {
             if (webRaw && webRaw.length > 0) {
               setResults(prev => {
                 // Prevent duplicates
                 const newWeb = webRaw.map((w: any, idx: number) => ({ id: `w-impl-${idx}`, ...w }));
                 const combined = [...prev.filter(r => !r.id.startsWith('w-impl')), ...newWeb];
                 return combined;
               });
             }
          }).catch(()=>{});
        }
      } catch (e) {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchLocal, 100);
    return () => clearTimeout(timer);
  }, [query]);

  // Derived results list (handle Expand/Collapse of web clutter)
  const displayResults = React.useMemo(() => {
    if (query.startsWith('/g ')) return results;
    
    const localAndPriority = results.filter(r => r.type !== 'web' || !r.isWeb || r.id === 'web-inline');
    const webClutter = results.filter(r => r.type === 'web' && r.isWeb && r.id !== 'web-inline');

    if (expandWeb) {
      return [...localAndPriority, ...webClutter].slice(0, 15);
    } else {
      const out = [...localAndPriority];
      // Keep ONE default web search (the fallback one)
      const fallback = webClutter.find(r => r.title.startsWith('Nach "'));
      if (fallback) out.push(fallback);
      
      // Add expand button if there are more
      if (webClutter.length > 1) {
        out.push({
          id: 'expand-btn',
          title: 'Web-Vorschläge einblenden',
          subtitle: `${webClutter.length - 1} weitere Ergebnisse (Tab drücken)`,
          type: 'web',
          isExpandBtn: true
        });
      }
      return out.slice(0, 15);
    }
  }, [results, expandWeb, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeAction(displayResults[selectedIndex]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setExpandWeb(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (viewMode !== 'search') {
        backToSearch();
      } else {
        try { api()?.hideWindow(); } catch(e) {}
      }
    }
  };

  const executeAction = (result: SearchResult) => {
    if (!result) return;
    try {
      if (result.isExpandBtn) {
        setExpandWeb(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (result.type === 'ai') {
        openAI();
      } else if (result.isWeb) {
        api()?.openUrl(result.path);
      } else if (result.path) {
        api()?.openFile(result.path);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'app': return <AppWindow size={16} />;
      case 'game': return <Gamepad2 size={16} />;
      case 'file': return <File size={16} />;
      case 'system': return <Settings size={16} />;
      case 'weather': return <CloudRain size={16} />;
      case 'calc': return <Calculator size={16} />;
      case 'ai': return <Bot size={16} />;
      case 'web': return <Globe size={16} />;
      default: return <File size={16} />;
    }
  };

  const getBadge = (type: string) => {
    switch (type) {
      case 'app': return 'App';
      case 'game': return 'Spiel';
      case 'system': return 'System';
      case 'weather': return 'Wetter';
      case 'calc': return 'Mathe';
      case 'file': return 'Datei';
      case 'ai': return 'KI';
      case 'web': return 'Web';
      default: return '';
    }
  };

  // Initialize Native Terminal if AI mode
  useEffect(() => {
    if (viewMode === 'ai' && termRef.current && !termInstance.current) {
      const term = new Terminal({
        theme: {
          background: '#0f0f14',
          foreground: '#f0f0f5',
          cursor: '#7c5cfc',
          selectionBackground: 'rgba(124, 92, 252, 0.3)',
        },
        fontFamily: "'Inter', 'Consolas', monospace",
        fontSize: 14,
        disableStdin: true, // We handle input externally via Chat UI to fix Windows cmd bugs
        convertEol: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current);
      fitAddon.fit();
      termInstance.current = term;

      // Listen for output from main process
      api()?.onTerminalOutput((data: string) => {
        term.write(data);
      });

      // Handle window resize
      const rs = () => fitAddon.fit();
      window.addEventListener('resize', rs);
      return () => {
        window.removeEventListener('resize', rs);
        term.dispose();
        termInstance.current = null;
      };
    }
  }, [viewMode]);

  const sendToTerminal = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!terminalInput.trim()) return;
    
    // Send input to our backend cmd.exe process
    api()?.sendTerminalInput(terminalInput + '\r\n');
    
    // Echo it in the terminal so user sees what they typed
    if (termInstance.current) {
      termInstance.current.writeln(`\x1b[35m> ${terminalInput}\x1b[0m`);
    }
    
    setTerminalInput('');
  };

  // ========================
  // RENDER
  // ========================

  // AI mode – Native API Chat
  if (viewMode === 'ai') {
    return (
      <div className="app-container">
        <div className="search-glass expanded">
          {/* Header bar */}
          <div className="webview-header">
            <button className="webview-back" onClick={backToSearch}>
              <ArrowLeft size={16} />
              <span>Zurück</span>
            </button>
            <span className="webview-title">Gemini CLI (Lokal)</span>
            <button className="webview-external" onClick={backToSearch}>
              <ExternalLink size={14} />
              <span>Abbrechen</span>
            </button>
          </div>
          
          {/* Main Content Area */}
          <div className="terminal-container">
            <div ref={termRef} className="xterm-wrapper" />
            <form className="terminal-input-bar" onSubmit={sendToTerminal}>
              <TerminalSquare size={16} className="terminal-icon" />
              <input 
                ref={terminalInputRef}
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                placeholder="Befehl an Gemini ('exit' zum Schließen)..."
                className="terminal-text-input"
                autoFocus
              />
              <button type="submit" className="terminal-send-btn">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Search mode
  return (
    <div className="app-container">
      <div className="search-glass">
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Suchen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoFocus
          />
          <div className="shortcut-hint">
            <kbd>ESC</kbd>
          </div>
        </div>

        {loading && <div className="loading-bar" />}

        {/* Quick Actions */}
        {!query.trim() && (
          <div className="quick-actions">
            <div className="quick-action" onClick={openAI}>
              <div className="quick-action-icon ai"><Bot size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">KI Chat</span>
                <span className="quick-action-sub">Google Gemini</span>
              </div>
            </div>
            <div className="quick-action" onClick={() => setQuery('/g ')}>
              <div className="quick-action-icon web"><Globe size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">Web Suche</span>
                <span className="quick-action-sub">Inline Ergebnisse</span>
              </div>
            </div>
            <div className="quick-action" onClick={() => setQuery('Downloads')}>
              <div className="quick-action-icon files"><File size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">Dateien</span>
                <span className="quick-action-sub">Schnellzugriff</span>
              </div>
            </div>
            <div className="quick-action" onClick={() => {
              setQuery('/g Wetter heute');
              setTimeout(() => {
                inputRef.current?.focus();
                // Move cursor to end
                inputRef.current?.setSelectionRange(15, 15);
              }, 50);
            }}>
              <div className="quick-action-icon calc"><Calculator size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">Wetter</span>
                <span className="quick-action-sub">Direkt anzeigen</span>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {displayResults.length > 0 && (
          <div className="results-container">
            {displayResults.map((res, idx) => (
              <div
                key={res.id}
                className={`result-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeAction(res)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={`result-icon ${res.iconBase64 ? 'custom' : res.type}`}>
                  {res.iconBase64 ? <img src={res.iconBase64} className="result-icon-img" alt="" /> : getIcon(res.type)}
                </div>
                <div className="result-content">
                  <span className="result-title" style={res.isExpandBtn ? { color: 'var(--accent)' } : {}}>{res.title}</span>
                  {res.subtitle && <span className="result-subtitle">{res.subtitle}</span>}
                </div>
                {!res.isExpandBtn && <span className="result-badge">{getBadge(res.type)}</span>}
                <span className="result-enter">{res.isExpandBtn ? 'Tab' : '↵'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="search-footer">
          <div className="footer-commands">
            <span><kbd>↑↓</kbd> navigieren</span>
            <span><kbd>↵</kbd> öffnen</span>
            <span><kbd>Tab</kbd> Web ansicht</span>
            <span><kbd>/ai</kbd> Chat</span>
          </div>
          <span>Windows Bar</span>
        </div>
      </div>
    </div>
  );
}

export default App;
