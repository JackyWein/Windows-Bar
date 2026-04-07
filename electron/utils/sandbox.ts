// Plugin Sandbox - isolates plugin code from sensitive Node.js APIs
import { Script, createContext, type Context } from 'node:vm';
import { promises as fs } from 'node:fs';

export interface SandboxContext {
  ctx: {
    logger: {
      log: (...args: any[]) => void;
      warn: (...args: any[]) => void;
      error: (...args: any[]) => void;
    };
    settings: Record<string, any>;
    pluginSettings: Record<string, any>;
    navigate: (view: string) => void;
    showResults: (results: any[]) => void;
    updateSetting: (key: string, value: any) => void;
  };
  api: {
    registerCommand: (command: any) => void;
    registerSearchProvider: (provider: any) => void;
    registerHook: (hookName: string, hook: Function) => void;
    invokeMainAction: (action: string, args?: any) => Promise<any>;
    showNotification: (message: string, type?: 'info' | 'success' | 'error') => void;
  };
}

export interface SandboxResult {
  success: boolean;
  exports?: any;
  error?: string;
}

// Create a safe sandbox context that blocks dangerous globals
function createSafeContext(sandboxCtx: SandboxContext): Context {
  const safeGlobal: Record<string, any> = {
    // Expose plugin API
    ctx: sandboxCtx.ctx,
    api: sandboxCtx.api,
    console: {
      log: sandboxCtx.ctx.logger.log,
      warn: sandboxCtx.ctx.logger.warn,
      error: sandboxCtx.ctx.logger.error,
    },
    // Basic utilities
    setTimeout: (fn: () => void, ms: number) => {
      if (ms > 10000) throw new Error('setTimeout max 10s');
      return globalThis.setTimeout(fn, ms);
    },
    setInterval: (fn: () => void, ms: number) => {
      if (ms > 10000) throw new Error('setInterval max 10s');
      return globalThis.setInterval(fn, ms);
    },
    clearTimeout: globalThis.clearTimeout,
    clearInterval: globalThis.clearInterval,
    Promise: globalThis.Promise,
    Array: globalThis.Array,
    Object: globalThis.Object,
    String: globalThis.String,
    Number: globalThis.Number,
    Boolean: globalThis.Boolean,
    Date: globalThis.Date,
    Math: globalThis.Math,
    JSON: globalThis.JSON,
    RegExp: globalThis.RegExp,
    Error: globalThis.Error,
    TypeError: globalThis.TypeError,
    parseInt: globalThis.parseInt,
    parseFloat: globalThis.parseFloat,
    isNaN: globalThis.isNaN,
    encodeURI: globalThis.encodeURI,
    decodeURI: globalThis.decodeURI,
    encodeURIComponent: globalThis.encodeURIComponent,
    decodeURIComponent: globalThis.decodeURIComponent,
    module: { exports: {} },
    exports: {},
    require: undefined, // Block require!
    process: undefined,  // Block process!
    global: undefined,   // Block global!
    Buffer: undefined,   // Block Buffer!
    __filename: undefined,
    __dirname: undefined,
  };

  return createContext(safeGlobal);
}

// Execute plugin code in sandbox
export async function executeInSandbox(
  pluginPath: string,
  sandboxCtx: SandboxContext,
  timeoutMs: number = 5000
): Promise<SandboxResult> {
  try {
    const code = await fs.readFile(pluginPath, 'utf-8');

    // Wrap code to capture module.exports - also execute it to set module.exports
    const wrappedCode = `
      (function(require, module, exports) {
        ${code}
      })(require, module, exports);
      module.exports;
    `;

    const context = createSafeContext(sandboxCtx);

    const script = new Script(wrappedCode);
    const result = script.runInContext(context, { timeout: timeoutMs });

    console.log('[Sandbox] result:', result, 'module.exports:', context.module.exports);

    return {
      success: true,
      exports: result || context.module.exports,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Validate plugin manifest
export function validateManifest(manifest: any): manifest is Record<string, any> {
  if (!manifest || typeof manifest !== 'object') return false;
  if (!manifest.id || typeof manifest.id !== 'string') return false;
  if (!manifest.name || typeof manifest.name !== 'string') return false;
  if (!manifest.version || typeof manifest.version !== 'string') return false;
  if (!manifest.description || typeof manifest.description !== 'string') return false;
  return true;
}
