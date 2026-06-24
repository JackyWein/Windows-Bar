import type { Command } from '../../../types';

// Unit → base-unit factor, grouped by category.
const UNITS: Record<string, { base: number; cat: string }> = {
  // length (base: meter)
  m: { base: 1, cat: 'len' }, meter: { base: 1, cat: 'len' }, km: { base: 1000, cat: 'len' },
  cm: { base: 0.01, cat: 'len' }, mm: { base: 0.001, cat: 'len' },
  mi: { base: 1609.344, cat: 'len' }, mile: { base: 1609.344, cat: 'len' }, yd: { base: 0.9144, cat: 'len' },
  ft: { base: 0.3048, cat: 'len' }, in: { base: 0.0254, cat: 'len' }, inch: { base: 0.0254, cat: 'len' },
  nmi: { base: 1852, cat: 'len' },
  // mass (base: gram)
  g: { base: 1, cat: 'mass' }, kg: { base: 1000, cat: 'mass' }, mg: { base: 0.001, cat: 'mass' },
  t: { base: 1e6, cat: 'mass' }, lb: { base: 453.59237, cat: 'mass' }, oz: { base: 28.349523, cat: 'mass' },
  // speed (base: m/s)
  'm/s': { base: 1, cat: 'spd' }, kmh: { base: 0.2777778, cat: 'spd' }, 'km/h': { base: 0.2777778, cat: 'spd' },
  mph: { base: 0.44704, cat: 'spd' }, kn: { base: 0.5144444, cat: 'spd' },
  // data (base: byte)
  b: { base: 1, cat: 'data' }, kb: { base: 1024, cat: 'data' }, mb: { base: 1024 ** 2, cat: 'data' },
  gb: { base: 1024 ** 3, cat: 'data' }, tb: { base: 1024 ** 4, cat: 'data' },
};

function convertTemp(value: number, from: string, to: string): number | null {
  let celsius: number;
  if (from === 'c') celsius = value;
  else if (from === 'f') celsius = (value - 32) * 5 / 9;
  else if (from === 'k') celsius = value - 273.15;
  else return null;
  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 9 / 5 + 32;
  if (to === 'k') return celsius + 273.15;
  return null;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
  return parseFloat(n.toFixed(6)).toLocaleString('de-DE', { maximumFractionDigits: 6 });
}

const convertCommands: readonly Command[] = [
  {
    id: 'units',
    trigger: '/units ',
    description: 'Einheiten umrechnen (Länge, Gewicht, Temp, Geschw., Daten)',
    usage: 'z.B. /units 10 km mi  •  /units 100 c f  •  /units 5 kg lb',
    aliases: ['/conv'],
    category: 'calc',
    handler(args: string) {
      const m = args.trim().toLowerCase().replace(',', '.').match(/^(-?[\d.]+)\s*([a-z/]+)\s+(?:in|to|->)?\s*([a-z/]+)$/);
      if (!m) {
        return { results: [{ id: 'cmd-usage', title: 'Einheiten umrechnen', subtitle: '/units 10 km mi  ·  /units 100 c f', type: 'calc' }] };
      }
      const value = parseFloat(m[1]);
      const from = m[2], to = m[3];

      // Temperature
      if (['c', 'f', 'k'].includes(from) || ['c', 'f', 'k'].includes(to)) {
        const res = convertTemp(value, from, to);
        if (res === null) return { results: [{ id: 'cmd-err', title: 'Temperatur-Umrechnung fehlgeschlagen', subtitle: 'Nutze c, f oder k', type: 'system' }] };
        const out = `${fmt(res)}°${to.toUpperCase()}`;
        return { results: [{ id: 'units-res', title: out, subtitle: `${fmt(value)}°${from.toUpperCase()} = ${out}`, type: 'calc', path: out }], copyToClipboard: out };
      }

      const uf = UNITS[from], ut = UNITS[to];
      if (!uf || !ut) return { results: [{ id: 'cmd-err', title: 'Unbekannte Einheit', subtitle: 'z.B. km, mi, kg, lb, c, f', type: 'system' }] };
      if (uf.cat !== ut.cat) return { results: [{ id: 'cmd-err', title: 'Inkompatible Einheiten', subtitle: `${from} und ${to} passen nicht zusammen`, type: 'system' }] };

      const res = (value * uf.base) / ut.base;
      const out = `${fmt(res)} ${to}`;
      return { results: [{ id: 'units-res', title: out, subtitle: `${fmt(value)} ${from} = ${out} • Enter zum Kopieren`, type: 'calc', path: out }], copyToClipboard: out };
    },
    enabled: true,
  },
  {
    id: 'currency',
    trigger: '/currency ',
    description: 'Währung umrechnen (Live-Kurse)',
    usage: 'z.B. /currency 100 usd eur  •  /currency 50 eur gbp',
    aliases: ['/cur'],
    category: 'calc',
    async handler(args: string) {
      const m = args.trim().toLowerCase().replace(',', '.').match(/^([\d.]+)\s*([a-z]{3})\s+(?:in|to|->)?\s*([a-z]{3})$/);
      if (!m) {
        return { results: [{ id: 'cmd-usage', title: 'Währung umrechnen', subtitle: '/currency 100 usd eur', type: 'calc' }] };
      }
      const value = parseFloat(m[1]);
      const from = m[2].toUpperCase(), to = m[3].toUpperCase();
      try {
        const r = await fetch(`https://open.er-api.com/v6/latest/${from}`);
        const data = await r.json();
        const rate = data?.rates?.[to];
        if (!rate || data.result !== 'success') {
          return { results: [{ id: 'cmd-err', title: 'Kurs nicht verfügbar', subtitle: `${from}→${to} nicht gefunden`, type: 'system' }] };
        }
        const res = value * rate;
        const out = `${res.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${to}`;
        return {
          results: [{ id: 'cur-res', title: out, subtitle: `${value} ${from} = ${out} • 1 ${from} = ${rate.toFixed(4)} ${to}`, type: 'calc', path: String(res.toFixed(2)) }],
          copyToClipboard: res.toFixed(2),
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Währung nicht abrufbar', subtitle: 'Netzwerkfehler', type: 'system' }] };
      }
    },
    enabled: true,
  },
];

export default convertCommands;
