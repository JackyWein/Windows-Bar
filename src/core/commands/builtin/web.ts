import type { Command, SearchResult, CommandContext } from '../../../types';

function runSpeedtest(ctx: CommandContext): void {
  const api = ctx.api;
  api.removeSpeedtestListeners?.();
  api.onSpeedtestProgress?.((data) => {
    ctx.showResults([{
      id: 'speedtest-running',
      title: `${data.mbps.toFixed(1)} Mbit/s`,
      subtitle: `Download läuft… ${Math.round(data.progress)}%`,
      type: 'web',
    }]);
  });
  api.runSpeedtest().then((res) => {
    api.removeSpeedtestListeners?.();
    ctx.showResults([
      { id: 'speedtest-dl', title: `${res.downloadMbps} Mbit/s`, subtitle: 'Download-Geschwindigkeit', type: 'web' },
      { id: 'speedtest-ping', title: `${res.pingMs} ms`, subtitle: 'Ping (Latenz)', type: 'web' },
    ]);
  }).catch(() => {
    api.removeSpeedtestListeners?.();
    ctx.showResults([{ id: 'cmd-err', title: 'Speedtest fehlgeschlagen', subtitle: 'Keine Verbindung?', type: 'system' }]);
  });
}

const webCommands: readonly Command[] = [
  {
    id: 'qr',
    trigger: '/qr ',
    description: 'QR-Code generieren',
    usage: 'z.B. /qr https://example.com',
    category: 'web',
    handler(args: string) {
      const text = args.trim();
      const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
      return {
        results: [{ 
          id: 'cmd-qr', 
          title: `QR-Code: ${preview}`, 
          subtitle: 'Enter drücken um in groß zu öffnen, oder scannen', 
          type: 'web', 
          path: qrUrl, 
          isWeb: true,
          iconBase64: qrUrl
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'ip',
    trigger: '/ip',
    description: 'IP-Adressen anzeigen (öffentlich & lokal)',
    category: 'web',
    async handler(_args, ctx) {
      const results: SearchResult[] = [];
      try {
        const r = await fetch('https://api.ipify.org?format=json');
        const data = await r.json();
        if (data?.ip) {
          results.push({ id: 'ip-public', title: String(data.ip), subtitle: 'Öffentliche IP • Enter zum Kopieren', type: 'web', path: String(data.ip), copyToClipboard: String(data.ip) });
        }
      } catch { /* offline */ }
      try {
        const local = await ctx.api.getLocalIp();
        (local?.ipv4 || []).forEach((ip, i) => {
          results.push({ id: `ip-local-${i}`, title: ip, subtitle: `Lokale IP (${local.hostname}) • Enter zum Kopieren`, type: 'system', path: ip, copyToClipboard: ip });
        });
      } catch { /* ignore */ }
      if (results.length === 0) {
        return { results: [{ id: 'cmd-err', title: 'IP nicht abrufbar', subtitle: 'Netzwerkfehler', type: 'system' }] };
      }
      return { results };
    },
    enabled: true,
  },
  {
    id: 'wifi',
    trigger: '/wifi',
    description: 'WLAN-Status & Netzwerke anzeigen',
    category: 'web',
    async handler(_args, ctx) {
      try {
        const info = await ctx.api.getNetworkInfo();
        const results: SearchResult[] = [];
        if (info.ssid) {
          results.push({ id: 'wifi-ssid', title: info.ssid, subtitle: `Verbunden${info.signal ? ' • Signal ' + info.signal : ''}${info.type ? ' • ' + info.type : ''}`, type: 'web', copyToClipboard: info.ssid });
        }
        for (const [i, p] of (info.profiles || []).slice(0, 12).entries()) {
          if (p === info.ssid) continue;
          results.push({ id: `wifi-prof-${i}`, title: p, subtitle: 'Gespeichertes Netzwerk', type: 'system', copyToClipboard: p });
        }
        if (results.length === 0) {
          return { results: [{ id: 'cmd-err', title: 'Keine WLAN-Infos', subtitle: 'WLAN evtl. deaktiviert oder nicht vorhanden', type: 'system' }] };
        }
        return { results };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'WLAN nicht abrufbar', subtitle: 'Fehler beim Abrufen', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'ping',
    trigger: '/ping ',
    description: 'Host anpingen',
    usage: 'z.B. /ping google.com',
    category: 'web',
    async handler(args, ctx) {
      const host = args.trim();
      if (!host) return { results: [{ id: 'cmd-usage', title: 'Host anpingen', subtitle: '/ping google.com', type: 'calc' }] };
      const res = await ctx.api.pingHost(host);
      return {
        results: [{
          id: 'ping-res',
          title: res.avg ? `${host} — ${res.avg}` : `${host}`,
          subtitle: res.loss !== undefined ? `Paketverlust: ${res.loss}` : 'Antwort erhalten',
          type: 'system',
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'dns',
    trigger: '/dns ',
    description: 'DNS-Auflösung (Host → IP)',
    usage: 'z.B. /dns github.com',
    category: 'web',
    async handler(args, ctx) {
      const host = args.trim();
      if (!host) return { results: [{ id: 'cmd-usage', title: 'DNS-Auflösung', subtitle: '/dns github.com', type: 'calc' }] };
      const res = await ctx.api.dnsLookup(host);
      if (!res.addresses.length) {
        return { results: [{ id: 'cmd-err', title: 'Keine Auflösung', subtitle: `${host} konnte nicht aufgelöst werden`, type: 'system' }] };
      }
      return {
        results: res.addresses.map((a, i) => ({ id: `dns-${i}`, title: a, subtitle: `${host} • Enter zum Kopieren`, type: 'web', path: a, copyToClipboard: a })),
      };
    },
    enabled: true,
  },
  {
    id: 'speedtest',
    trigger: '/speedtest',
    description: 'Internet-Geschwindigkeit testen',
    aliases: ['/speed'],
    category: 'web',
    async handler(_args, ctx) {
      return {
        results: [{
          id: 'speedtest-start',
          title: 'Speedtest starten',
          subtitle: 'Enter zum Messen (Download & Ping)',
          type: 'web',
          action: () => { ctx.showResults([{ id: 'speedtest-running', title: 'Speedtest läuft…', subtitle: 'Messe Download-Geschwindigkeit', type: 'web' }]); runSpeedtest(ctx); },
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'wiki',
    trigger: '/wiki ',
    description: 'Wikipedia-Artikel suchen',
    usage: 'z.B. /wiki Albert Einstein',
    category: 'web',
    async handler(args: string) {
      const term = args.trim();
      try {
        const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`);
        const data = await r.json();
        const title = data.title || term;
        const subtitle = data.extract?.substring(0, 80) || 'Artikel öffnen';
        const url = data.content_url || `https://de.wikipedia.org/wiki/${term}`;
        return {
          results: [{ id: 'cmd-wiki', title, subtitle, type: 'web', path: url, isWeb: true }],
        };
      } catch {
        const url = `https://de.wikipedia.org/wiki/${term}`;
        return {
          results: [{ id: 'cmd-wiki', title: `${term} auf Wikipedia`, subtitle: 'Enter zum Öffnen', type: 'web', path: url, isWeb: true }],
        };
      }
    },
    enabled: true,
  },
  {
    id: 'tr',
    trigger: '/tr ',
    description: 'Text übersetzen',
    usage: '/tr de:en Text zum Übersetzen',
    category: 'web',
    async handler(args: string) {
      const trimmed = args.trim();

      // Show usage if no args
      if (!trimmed) {
        return { results: [{ id: 'cmd-usage', title: 'Text übersetzen', subtitle: '/tr de:en Text zum Übersetzen', type: 'calc' }] };
      }

      // Support both colon (:) and semicolon (;) as separators
      const match = trimmed.match(/^([a-z]{2})[:;]([a-z]{2})\s+(.+)$/i);
      if (match) {
        const from = match[1].toLowerCase();
        const to = match[2].toLowerCase();
        const text = match[3];
        const preview = text.length > 25 ? text.substring(0, 25) + '...' : text;
        const deeplUrl = `https://www.deepl.com/translator#${from}/${to}/${encodeURIComponent(text)}`;

        // Try MyMemory Translation API (free, no API key needed)
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);

          if (response.ok) {
            const data = await response.json();

            if (data.responseStatus === 200 && data.responseData?.translatedText) {
              const translatedText = data.responseData.translatedText;

              return {
                results: [
                  {
                    id: 'cmd-tr-result',
                    title: translatedText,
                    subtitle: `${from.toUpperCase()} → ${to.toUpperCase()} • Enter zum Kopieren`,
                    type: 'calc',
                    copyToClipboard: translatedText,
                  },
                  {
                    id: 'cmd-tr-deepl',
                    title: 'In DeepL öffnen',
                    subtitle: 'Alternative Übersetzung',
                    type: 'web',
                    path: deeplUrl,
                  },
                ],
              };
            }
          }

          // Fallback: Show DeepL option
          return {
            results: [
              {
                id: 'cmd-tr-translate',
                title: `"${preview}" übersetzen`,
                subtitle: `${from.toUpperCase()} → ${to.toUpperCase()} via DeepL`,
                type: 'web',
                path: deeplUrl,
              },
            ],
          };
        } catch {
          // Fallback: Show DeepL option
          return {
            results: [
              {
                id: 'cmd-tr-translate',
                title: `"${preview}" übersetzen`,
                subtitle: `${from.toUpperCase()} → ${to.toUpperCase()} via DeepL`,
                type: 'web',
                path: deeplUrl,
              },
            ],
          };
        }
      }

      // Check if user provided incomplete format (e.g., "de:en" or "de;en" without text)
      const partialMatch = trimmed.match(/^([a-z]{2})[:;]([a-z]{2})$/i);
      if (partialMatch) {
        return { results: [{ id: 'cmd-usage', title: 'Text fehlt', subtitle: `/tr ${trimmed} <Text zum Übersetzen>`, type: 'calc' }] };
      }

      return { results: [{ id: 'cmd-err', title: 'Ungültiges Format', subtitle: 'Verwendung: /tr de:en Hallo Welt', type: 'system' }] };
    },
    enabled: true,
  },
];

export default webCommands;