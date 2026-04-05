import type { Command } from '../../../types';

const powerCommands: readonly Command[] = [
  {
    id: 'sleep',
    trigger: '/sleep',
    description: 'Bildschirm ausschalten',
    category: 'power',
    handler(_args, ctx) {
      ctx.api.sleepDisplay();
      return {
        results: [{ id: 'cmd-sleep', title: 'Bildschirm ausschalten', subtitle: 'Wird ausgeführt...', type: 'system' }],
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
      ctx.api.toggleMute();
      return {
        results: [{ id: 'cmd-mute', title: 'Stummschalten', subtitle: 'Wird ausgeführt...', type: 'system' }],
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
      ctx.api.emptyTrash();
      return {
        results: [{ id: 'cmd-trash', title: 'Papierkorb leeren', subtitle: 'Wird ausgeführt...', type: 'system' }],
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
      ctx.api.takeScreenshot();
      return {
        results: [{ id: 'cmd-ss', title: 'Screenshot erstellt', subtitle: 'Gespeichert in Bilder', type: 'system' }],
      };
    },
    enabled: true,
  },
  {
    id: 'lock',
    trigger: '/lock',
    description: 'PC sperren',
    category: 'power',
    handler(_args, ctx) {
      ctx.api.openUrl('cmd://lock');
      return {
        results: [{ id: 'cmd-lock', title: 'PC sperren', subtitle: 'Wird ausgeführt...', type: 'system' }],
      };
    },
    enabled: true,
  },
  {
    id: 'shutdown',
    trigger: '/shutdown',
    description: 'Herunterfahren',
    category: 'power',
    handler(_args, ctx) {
      ctx.api.openUrl('cmd://shutdown');
      return {
        results: [{ id: 'cmd-shut', title: 'Herunterfahren', subtitle: 'PC wird heruntergefahren...', type: 'system' }],
      };
    },
    enabled: true,
  },
  {
    id: 'restart',
    trigger: '/restart',
    description: 'Neustart',
    category: 'power',
    handler(_args, ctx) {
      ctx.api.openUrl('cmd://restart');
      return {
        results: [{ id: 'cmd-rest', title: 'Neustart', subtitle: 'PC wird neu gestartet...', type: 'system' }],
      };
    },
    enabled: true,
  },
];

export default powerCommands;
