import type { Command } from '../../types';

class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(cmd: Command): void {
    this.commands.set(cmd.id, cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.commands.set(alias, cmd);
      }
    }
  }

  unregister(id: string): void {
    const cmd = this.commands.get(id);
    if (cmd && cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.commands.delete(alias);
      }
    }
    this.commands.delete(id);
  }

  match(input: string): Command | undefined {
    const entries = Array.from(this.commands.values());
    for (const cmd of entries) {
      if (!cmd.enabled) continue;
      if (typeof cmd.trigger === 'string') {
        if (input.startsWith(cmd.trigger)) return cmd;
      } else {
        if (cmd.trigger.test(input)) return cmd;
      }
    }
    return undefined;
  }

  getCommandById(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): readonly Command[] {
    const seen = new Set<string>();
    const unique: Command[] = [];
    const entries = Array.from(this.commands.values());
    for (const cmd of entries) {
      if (!seen.has(cmd.id)) {
        seen.add(cmd.id);
        unique.push(cmd);
      }
    }
    return unique;
  }

  getByCategory(category: Command['category']): readonly Command[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  setEnabled(id: string, enabled: boolean): void {
    const cmd = this.commands.get(id);
    if (cmd) {
      cmd.enabled = enabled;
    }
  }
}

export const commandRegistry = new CommandRegistry();
