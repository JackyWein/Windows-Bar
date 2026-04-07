// External Commands Loader (Renderer Side)
// Listens for external commands from the main process and registers them
import { commandRegistry } from './registry';
import type { Command } from '../../types';

let isInitialized = false;

export function initExternalCommands(): void {
  if (isInitialized) return;
  isInitialized = true;

  if (!window.electronAPI?.onExternalCommands) {
    console.warn('[ExternalCommands] electronAPI.onExternalCommands not available');
    return;
  }

  window.electronAPI.onExternalCommands((rawCommands: any[]) => {
    if (!rawCommands || rawCommands.length === 0) {
      console.log('[ExternalCommands] No external commands received');
      return;
    }

    console.log(`[ExternalCommands] Received ${rawCommands.length} command(s) from main process`);

    // Convert raw command objects to proper Command type
    const commands: Command[] = rawCommands.map((raw: any) => ({
      id: raw.id,
      trigger: raw.trigger,
      description: raw.description,
      usage: raw.usage,
      category: raw.category || 'system',
      handler: raw.handler,
      enabled: raw.enabled !== false,
      aliases: raw.aliases,
      requiresSetting: raw.requiresSetting,
    }));

    // Register them in the command registry
    commandRegistry.registerExternal(commands);
    console.log(`[ExternalCommands] Registered ${commands.length} external command(s)`);
  });
}
