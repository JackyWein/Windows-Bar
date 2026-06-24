import type { Command } from '../../../types';

interface SystemInfo {
  cpu?: { cores?: number; model?: string };
  memory?: { used?: string; total?: string; usedPercent?: string };
  disk?: { free?: string; total?: string; usedPercent?: string };
}

interface ProcessInfo {
  name: string;
  pid: string;
  memory: string;
}

const systemCommands: readonly Command[] = [
  {
    id: 'sys',
    trigger: '/sys',
    description: 'System-Info anzeigen',
    category: 'system',
    async handler(_args, ctx) {
      try {
        const info = await ctx.api.getSystemInfo() as SystemInfo;
        if (!info) {
          return { results: [{ id: 'cmd-err', title: 'System-Info nicht verfügbar', subtitle: 'Fehler beim Abrufen', type: 'system' }] };
        }
        return {
          results: [
            { id: 'sys-cpu', title: `CPU: ${info.cpu?.cores ?? '?'} Kerne`, subtitle: info.cpu?.model?.substring(0, 40) ?? 'Unbekannt', type: 'system' },
            { id: 'sys-ram', title: `RAM: ${info.memory?.used ?? '?'}/${info.memory?.total ?? '?'} GB (${info.memory?.usedPercent ?? '?'}%)`, subtitle: 'Arbeitsspeicher', type: 'system' },
            { id: 'sys-disk', title: `Disk: ${info.disk?.free ?? '?'}/${info.disk?.total ?? '?'} GB frei`, subtitle: `${info.disk?.usedPercent ?? '?'}% verwendet`, type: 'system' },
          ],
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'System-Info Fehler', subtitle: 'Konnte nicht abgerufen werden', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'battery',
    trigger: '/battery',
    description: 'Akku-Status anzeigen',
    aliases: ['/akku'],
    category: 'system',
    async handler(_args, ctx) {
      try {
        const bat = await ctx.api.getBattery();
        if (!bat) {
          return { results: [{ id: 'cmd-bat', title: 'Kein Akku gefunden', subtitle: 'Desktop-PC oder Akku nicht lesbar', type: 'system' }] };
        }
        const icon = bat.charging ? '⚡' : (bat.percent <= 20 ? '🪫' : '🔋');
        return {
          results: [{
            id: 'bat-status',
            title: `${icon} ${bat.percent}%`,
            subtitle: bat.charging ? 'Wird geladen / am Netz' : 'Akkubetrieb',
            type: 'system',
          }],
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Akku nicht abrufbar', subtitle: 'Fehler beim Abrufen', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'proc',
    trigger: '/proc',
    description: 'Laufende Prozesse auflisten',
    category: 'system',
    async handler(_args, ctx) {
      try {
        const procs = await ctx.api.listProcesses() as ProcessInfo[];
        const results = procs.slice(0, 15).map((p, i) => ({
          id: `proc-${i}`,
          title: p.name,
          subtitle: `PID: ${p.pid} \u2022 ${p.memory}`,
          type: 'app' as const,
        }));
        return { results };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Prozessliste nicht verfügbar', subtitle: 'Fehler beim Abrufen', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'kill',
    trigger: '/kill ',
    description: 'Prozess beenden',
    usage: 'z.B. /kill notepad  •  /kill chrome',
    category: 'system',
    handler(args: string, ctx) {
      const name = args.trim();
      if (!name) {
        return { results: [{ id: 'cmd-err', title: 'Kein Prozessname', subtitle: '/kill notepad', type: 'system' }] };
      }
      return {
        results: [{
          id: 'cmd-kill',
          title: `${name}.exe beenden`,
          subtitle: 'Enter zum Beenden',
          type: 'system',
          action: () => {
            ctx.api.killProcess(name);
            (window as any).electronAPI?.hideWindow();
          }
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'run',
    trigger: '/run ',
    description: 'Programm starten',
    usage: 'z.B. /run notepad  •  /run calc  •  /run cmd',
    category: 'system',
    handler(args: string, ctx) {
      const program = args.trim();
      if (!program) {
        return { results: [{ id: 'cmd-err', title: 'Kein Programm', subtitle: '/run notepad', type: 'system' }] };
      }
      return {
        results: [{
          id: 'cmd-run', title: `${program} starten`, subtitle: 'Enter zum Ausführen', type: 'system',
          action: () => { ctx.api.runProgram(program); }
        }],
      };
    },
    enabled: true,
  },
];

export default systemCommands;
