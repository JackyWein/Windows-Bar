interface AIChatRequest {
  providerType: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cliCommand?: string;
  cliArgs?: string[];
  cliInput?: string;
}

interface ElectronAPI {
  openAiChat: () => void;
  openUrl: (url: string) => void;
  openFile: (path: string) => void;
  hideWindow: () => void;
  resizeWindow: (w: number, h: number) => void;
  searchEverything: (query: string) => Promise<unknown[]>;
  fetchInstantAnswer: (query: string) => Promise<unknown[]>;

  startTerminal: () => void;
  stopTerminal: () => void;
  sendTerminalInput: (data: string) => void;
  onTerminalOutput: (callback: (data: string) => void) => void;
  listDirectory: (path: string) => Promise<unknown[]>;
  getFileIcon: (path: string) => Promise<string | null>;

  getSystemInfo: () => Promise<unknown>;
  sleepDisplay: () => void;
  setVolume: (level: number) => void;
  toggleMute: () => void;
  emptyTrash: () => void;
  takeScreenshot: () => void;
  onScreenshotResult: (callback: (result: { success: boolean; path?: string; error?: string }) => void) => void;
  killProcess: (name: string) => Promise<{ success: boolean; error?: string }>;
  listProcesses: () => Promise<{ name: string; pid: string; memory: string }[]>;
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => void;

  // AI Chat
  aiChat: (request: AIChatRequest) => Promise<unknown>;
  aiAbort: () => void;
  onAiChunk: (callback: (chunk: string) => void) => void;
  onAiComplete: (callback: (result: unknown) => void) => void;
  onAiError: (callback: (error: string) => void) => void;
  removeAiListeners: () => void;

  // Credential storage
  storeCredential: (key: string, value: string) => Promise<boolean>;
  getCredential: (key: string) => Promise<string | null>;
  deleteCredential: (key: string) => Promise<boolean>;
}

interface PluginAPI {
  list: () => Promise<unknown[]>;
  install: (source: string) => Promise<unknown>;
  uninstall: (id: string) => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
}

interface Window {
  electronAPI: ElectronAPI;
  pluginAPI: PluginAPI;
}
