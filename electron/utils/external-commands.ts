// External Commands Loader - scans and loads .js command files from user commands folder
import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface ExternalCommandFile {
  file: string;
  commands: any[];
  error?: string;
}

// Get the external commands directory path
export function getCommandsDir(): string {
  const appData = app.getPath('userData');
  return join(appData, 'commands');
}

// Ensure the commands directory exists
export async function ensureCommandsDir(): Promise<string> {
  const dir = getCommandsDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory might already exist
  }
  return dir;
}

// Validate a single command object
function validateCommand(cmd: any, _fileName: string): cmd is Record<string, unknown> {
  if (!cmd || typeof cmd !== 'object') return false;
  if (!cmd.id || typeof cmd.id !== 'string') return false;
  if (!cmd.trigger || (typeof cmd.trigger !== 'string' && !(cmd.trigger instanceof RegExp))) return false;
  if (!cmd.description || typeof cmd.description !== 'string') return false;
  if (!cmd.category || typeof cmd.category !== 'string') return false;
  if (typeof cmd.handler !== 'function') return false;
  return true;
}

// Scan and load all external command files
export async function loadExternalCommands(): Promise<ExternalCommandFile[]> {
  const dir = await ensureCommandsDir();
  const results: ExternalCommandFile[] = [];

  try {
    const files = await fs.readdir(dir);
    const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.cjs'));

    if (jsFiles.length === 0) {
      console.log('[ExternalCommands] No external command files found.');
      return results;
    }

    console.log(`[ExternalCommands] Found ${jsFiles.length} command file(s) in ${dir}`);

    for (const file of jsFiles) {
      const filePath = join(dir, file);
      try {
        // Clear require cache to allow hot-reloading
        delete require.cache[require.resolve(filePath)];

        const mod = require(filePath);
        const commands = Array.isArray(mod) ? mod : (mod.default ? (Array.isArray(mod.default) ? mod.default : [mod.default]) : [mod]);

        // Validate each command
        const validCommands = commands.filter((cmd: any) => {
          const isValid = validateCommand(cmd, file);
          if (!isValid) {
            console.warn(`[ExternalCommands] Invalid command in ${file}:`, cmd?.id || 'unknown');
          }
          return isValid;
        });

        // Ensure enabled defaults to true
        for (const cmd of validCommands) {
          if (cmd.enabled === undefined) {
            cmd.enabled = true;
          }
        }

        results.push({ file, commands: validCommands });
        console.log(`[ExternalCommands] Loaded ${validCommands.length} command(s) from ${file}`);
      } catch (error) {
        console.error(`[ExternalCommands] Failed to load ${file}:`, error);
        results.push({
          file,
          commands: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    console.error('[ExternalCommands] Failed to read commands directory:', error);
  }

  return results;
}

// Get list of external command files (without loading them)
export async function listExternalCommandFiles(): Promise<{ file: string; error?: string }[]> {
  const dir = await ensureCommandsDir();
  const results: { file: string; error?: string }[] = [];

  try {
    const files = await fs.readdir(dir);
    const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.cjs'));

    for (const file of jsFiles) {
      results.push({ file });
    }
  } catch (error) {
    console.error('[ExternalCommands] Failed to list command files:', error);
  }

  return results;
}
