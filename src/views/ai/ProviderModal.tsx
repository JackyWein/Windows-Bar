import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, Zap, RotateCcw } from 'lucide-react';
import type { AISettings, ProviderConfig } from '../../core/ai';
import { providerRegistry } from '../../core/ai';
import type { ConfirmOptions } from '../../components/ConfirmDialog';

interface ProviderModalProps {
  readonly settings: AISettings;
  readonly onSettingsChange: (settings: AISettings) => void;
  readonly onClose: () => void;
  readonly confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const PROVIDER_HINTS = (
  <div className="ai-footer-commands" style={{ padding: '8px 20px 10px', borderTop: '1px solid var(--border)' }}>
    <span><kbd>Tab</kbd> Navigate</span>
    <span><kbd>Esc</kbd> Close</span>
  </div>
);

export function ProviderModal({ settings, onSettingsChange, onClose, confirm }: ProviderModalProps) {
  const providers = providerRegistry.getAll();
  const [selectedProvider, setSelectedProvider] = useState<string>(
    settings.defaultProvider ?? providers[0]?.id ?? '',
  );
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [_focusIndex, setFocusIndex] = useState(-1);
  const toggleRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Sync selected provider when settings change externally
  useEffect(() => {
    if (settings.defaultProvider) {
      setSelectedProvider(settings.defaultProvider);
    }
  }, [settings.defaultProvider]);

  const provider = providerRegistry.getById(selectedProvider);
  const models = provider
    ? providerRegistry.getModelsForProvider(selectedProvider, settings.providers)
    : [];

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateProviderConfig = useCallback(
    (providerId: string, update: Partial<ProviderConfig>) => {
      const current = settings.providers[providerId] ?? {
        enabled: false,
      };
      const updated: ProviderConfig = { ...current, ...update };
      const newProviders = { ...settings.providers, [providerId]: updated };

      // If enabling this provider and no default set, make it default
      let newDefault = settings.defaultProvider;
      let newModel = settings.defaultModel;
      if (update.enabled && !settings.defaultProvider) {
        newDefault = providerId;
        const prov = providerRegistry.getById(providerId);
        if (prov && !newModel) {
          newModel = prov.models[0]?.id ?? null;
        }
      }

      onSettingsChange({
        ...settings,
        defaultProvider: newDefault,
        defaultModel: newModel,
        providers: newProviders,
        setupComplete: true,
      });
    },
    [settings, onSettingsChange],
  );

  const handleProviderChange = useCallback(
    (providerId: string) => {
      setSelectedProvider(providerId);
      setTestResult(null);
      const config = settings.providers[providerId];
      if (!config?.enabled) {
        updateProviderConfig(providerId, { enabled: true });
      }
      // Update default provider/model
      const prov = providerRegistry.getById(providerId);
      if (prov) {
        const existingModel = settings.defaultModel;
        const hasModel = prov.models.some((m) => m.id === existingModel);
        onSettingsChange({
          ...settings,
          defaultProvider: providerId,
          defaultModel: hasModel ? existingModel : prov.models[0]?.id ?? null,
          providers: settings.providers,
          setupComplete: true,
        });
      }
    },
    [settings, updateProviderConfig, onSettingsChange],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      onSettingsChange({
        ...settings,
        defaultModel: modelId,
        providers: settings.providers,
        setupComplete: true,
      });
    },
    [settings, onSettingsChange],
  );

  const toggleApiKeyVisibility = useCallback((providerId: string) => {
    setShowApiKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  }, []);

  const handleTestConnection = useCallback(
    async (providerId: string) => {
      const prov = providerRegistry.getById(providerId);
      if (!prov) return;

      const config = settings.providers[providerId];
      if (!config || !prov.validateConfig(config)) {
        setTestResult({ type: 'error', message: 'Configure this provider first (add API key or endpoint).' });
        return;
      }

      setTesting(providerId);
      setTestResult(null);
      try {
        const testMessages = [
          { id: 'test', role: 'user' as const, content: 'Hi', timestamp: Date.now() },
        ];
        const request = prov.buildRequest(testMessages, prov.models[0]?.id ?? '', config);
        await window.electronAPI.aiChat(request as Parameters<typeof window.electronAPI.aiChat>[0]);
        setTestResult({ type: 'success', message: 'Connection successful!' });
      } catch (err) {
        setTestResult({ type: 'error', message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` });
      } finally {
        setTesting(null);
      }
    },
    [settings.providers],
  );

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset Provider Settings',
      message: 'Reset all provider settings to defaults? This will remove API keys and custom configurations.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (ok) {
      onSettingsChange({
        defaultProvider: null,
        defaultModel: null,
        setupComplete: false,
        providers: {},
      });
      onClose();
    }
  }, [onSettingsChange, onClose, confirm]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const count = providers.length;
      if (count === 0) return;
      setFocusIndex((prev) => (prev + (e.shiftKey ? -1 : 1) + count) % count);
    }
  }, [providers.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-card" style={{ width: '520px', maxHeight: '560px' }}>
        <div className="modal-header">
          <span className="modal-title">Providers & Models</span>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="drawer-content">
          {/* Active Provider */}
          <div className="drawer-section">
            <div className="drawer-section-title">Active Provider</div>
            <select
              className="drawer-select"
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Model */}
          <div className="drawer-section">
            <div className="drawer-section-title">Model</div>
            <select
              className="drawer-select"
              value={settings.defaultModel ?? ''}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              <option value="" disabled>
                Select a model...
              </option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Provider Configurations */}
          <div className="drawer-section">
            <div className="drawer-section-title">Configuration</div>
            {providers.map((p, i) => {
              const config = settings.providers[p.id] ?? { enabled: false };
              const isExpanded = p.id === selectedProvider;
              const showKey = showApiKeys[p.id] ?? false;

              return (
                <div key={p.id}>
                  <div className="drawer-toggle-row">
                    <span className="drawer-toggle-label">{p.name}</span>
                    <button
                      ref={(el) => { toggleRefs.current[i] = el; }}
                      className={`drawer-toggle${config.enabled ? ' checked' : ''}`}
                      onClick={() => updateProviderConfig(p.id, { enabled: !config.enabled })}
                      role="switch"
                      aria-checked={config.enabled}
                    />
                  </div>

                  {isExpanded && config.enabled && (
                    <div style={{ paddingLeft: '12px', paddingTop: '4px' }}>
                      {p.type === 'api' && p.id !== 'ollama' && (
                        <div className="drawer-input-group">
                          <label className="drawer-label">API Key</label>
                          <div className="drawer-input-row">
                            <input
                              type={showKey ? 'text' : 'password'}
                              className="drawer-input password"
                              placeholder={`Enter ${p.name} API key...`}
                              value={config.apiKey ?? ''}
                              onChange={(e) =>
                                updateProviderConfig(p.id, { apiKey: e.target.value })
                              }
                            />
                            <button
                              className="drawer-password-toggle"
                              onClick={() => toggleApiKeyVisibility(p.id)}
                            >
                              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      )}

                      {(p.id === 'ollama' || !providerRegistry.isBuiltin(p.id)) && (
                        <div className="drawer-input-group">
                          <label className="drawer-label">Endpoint URL</label>
                          <input
                            type="text"
                            className="drawer-input"
                            placeholder={
                              p.id === 'ollama'
                                ? 'http://localhost:11434'
                                : 'https://api.example.com/v1'
                            }
                            value={config.endpoint ?? ''}
                            onChange={(e) =>
                              updateProviderConfig(p.id, { endpoint: e.target.value })
                            }
                          />
                        </div>
                      )}

                      {p.type === 'cli' && (
                        <div className="drawer-input-group">
                          <label className="drawer-label">CLI Command</label>
                          <input
                            type="text"
                            className="drawer-input"
                            placeholder={p.id === 'gemini-cli' ? 'gemini' : 'command'}
                            value={config.cliCommand ?? ''}
                            onChange={(e) =>
                              updateProviderConfig(p.id, { cliCommand: e.target.value })
                            }
                          />
                        </div>
                      )}

                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '6px 0 0' }}>
                        {p.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Test result inline message */}
        {testResult && (
          <div className={`provider-test-result ${testResult.type}`}>
            {testResult.message}
          </div>
        )}

        <div className="drawer-actions">
          <button
            className="drawer-action-btn secondary"
            onClick={() => handleTestConnection(selectedProvider)}
            disabled={testing !== null}
          >
            <Zap size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button className="drawer-action-btn secondary" onClick={handleReset}>
            <RotateCcw size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            Reset
          </button>
        </div>
        {PROVIDER_HINTS}
      </div>
    </div>
  );
}
