import { commandRegistry } from '../registry';
import calcCommands from './calc';
import textCommands from './text';
import webCommands from './web';
import weatherCommands from './weather';
import notesCommands from './notes';
import clipboardCommands from './clipboard';
import systemCommands from './system';
import powerCommands from './power';

function registerBuiltinCommands(): void {
  for (const cmd of calcCommands) commandRegistry.register(cmd);
  for (const cmd of textCommands) commandRegistry.register(cmd);
  for (const cmd of webCommands) commandRegistry.register(cmd);
  for (const cmd of weatherCommands) commandRegistry.register(cmd);
  for (const cmd of notesCommands) commandRegistry.register(cmd);
  for (const cmd of clipboardCommands) commandRegistry.register(cmd);
  for (const cmd of systemCommands) commandRegistry.register(cmd);
  for (const cmd of powerCommands) commandRegistry.register(cmd);
}

export { registerBuiltinCommands };
