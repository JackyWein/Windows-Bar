import type { Command } from '../../../types';

const api = () => (window as { electronAPI: typeof window.electronAPI }).electronAPI;

const powerCommands: readonly Command[] = [
  {
    id: 'sleep',
    trigger: '/sleep',
    description: 'Bildschirm ausschalten',
    category: 'power',
    handler(_args, ctx) {
      return {
        results: [{
          id: 'cmd-sleep', title: 'Bildschirm ausschalten', subtitle: 'Enter zum Ausführen', type: 'system',
          action: () => { ctx.api.sleepDisplay(); api()?.hideWindow(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'mute',
    trigger: '/mute',
    description: 'Stummschalten umschalten',
    category: 'power',
    handler(_args, ctx) {
      return {
        results: [{
          id: 'cmd-mute', title: 'Stummschalten umschalten', subtitle: 'Enter zum Ausführen', type: 'system',
          action: () => { ctx.api.toggleMute(); api()?.hideWindow(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'volume',
    trigger: '/volume',
    description: 'Lautstärke setzen (0–100)',
    usage: '/volume 50  •  /volume 0  •  /volume 100',
    category: 'power',
    handler(args) {
      const level = Math.max(0, Math.min(100, parseInt(args.trim(), 10)));
      if (isNaN(level)) {
        return { results: [{ id: 'cmd-err', title: 'Ungültige Lautstärke', subtitle: '/volume 50 (0–100)', type: 'system' }] };
      }
      return {
        results: [{
          id: 'cmd-volume', title: `Lautstärke auf ${level}%`, subtitle: 'Enter zum Setzen', type: 'system',
          action: () => { api()?.setVolumeAbsolute(level); api()?.hideWindow(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'trash',
    trigger: '/trash',
    description: 'Papierkorb leeren',
    category: 'power',
    handler(_args, ctx) {
      return {
        results: [{
          id: 'cmd-trash', title: 'Papierkorb leeren', subtitle: 'Enter zum Ausführen', type: 'system',
          action: () => { ctx.api.emptyTrash(); api()?.hideWindow(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'ss',
    trigger: '/ss',
    description: 'Screenshot erstellen',
    category: 'power',
    handler(_args, ctx) {
      return {
        results: [{
          id: 'cmd-ss', title: 'Screenshot erstellen', subtitle: 'Enter zum Ausführen (Gespeichert in Bilder)', type: 'system',
          action: () => { ctx.api.takeScreenshot(); api()?.hideWindow(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'lock',
    trigger: '/lock',
    description: 'PC sperren',
    category: 'power',
    handler() {
      return {
        results: [{
          id: 'cmd-lock', title: 'PC sperren', subtitle: 'Enter zum Ausführen', type: 'system',
          action: () => { api()?.lockPC(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'shutdown',
    trigger: '/shutdown',
    description: 'Herunterfahren',
    category: 'power',
    handler() {
      return {
        results: [{
          id: 'cmd-shut', title: 'Herunterfahren', subtitle: 'Enter zum Ausführen — fährt den PC herunter!', type: 'system',
          action: () => { api()?.shutdownPC(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'restart',
    trigger: '/restart',
    description: 'Neustart',
    category: 'power',
    handler() {
      return {
        results: [{
          id: 'cmd-rest', title: 'Neustart', subtitle: 'Enter zum Ausführen — startet den PC neu!', type: 'system',
          action: () => { api()?.restartPC(); }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'logoff',
    trigger: '/logoff',
    description: 'Abmelden',
    aliases: ['/signout'],
    category: 'power',
    handler() {
      return {
        results: [{
          id: 'cmd-logoff', title: 'Abmelden', subtitle: 'Enter zum Ausführen', type: 'system',
          action: () => { api()?.signOut(); }
        }],
      };
    },
    enabled: true,
  },
];

export default powerCommands;
