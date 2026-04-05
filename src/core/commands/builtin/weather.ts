import type { Command } from '../../../types';

interface HourlyData {
  time: string;
  temp: number;
  feelsLike: number;
  chanceOfRain: string;
  weatherIcon: string;
}

interface WttrCurrent {
  temp_C: string;
  FeelsLikeC: string;
  humidity: string;
  windspeedKmph: string;
  winddir16Point: string;
  uvIndex: string;
  visibility: string;
  pressure: string;
  cloudcover: string;
  precipMM: string;
  lang_de?: { value: string }[];
  weatherDesc?: { value: string }[];
}

interface WttrAstronomy {
  sunrise: string;
  sunset: string;
}

interface WttrHourly {
  time: string;
  tempC: string;
  FeelsLikeC: string;
  chanceofrain: string;
  weatherCode: string;
}

interface WttrWeatherDay {
  mintempC: string;
  maxtempC: string;
  astronomy: WttrAstronomy[];
  hourly: WttrHourly[];
}

interface WttrResponse {
  current_condition?: WttrCurrent[];
  weather?: WttrWeatherDay[];
}

const weatherCommands: readonly Command[] = [
  {
    id: 'wetter',
    trigger: '/wetter',
    description: 'Wetter abrufen',
    category: 'web',
    requiresSetting: 'features.weatherEnabled',
    async handler(args: string, ctx) {
      const city = args.trim() || ctx.settings.search.defaultCity;
      try {
        const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=de`);
        const data: WttrResponse = await r.json();
        const current = data.current_condition?.[0];
        const today = data.weather?.[0];
        const hourly = today?.hourly || [];

        if (!current) {
          return { results: [{ id: 'cmd-err', title: 'Wetter nicht verfügbar', subtitle: 'Keine Daten erhalten', type: 'system' }] };
        }

        const hourlyData: HourlyData[] = hourly.map((h: WttrHourly) => ({
          time: h.time,
          temp: parseInt(h.tempC),
          feelsLike: parseInt(h.FeelsLikeC),
          chanceOfRain: h.chanceofrain,
          weatherIcon: h.weatherCode,
        }));

        const weatherDesc = current.lang_de?.[0]?.value || current.weatherDesc?.[0]?.value || 'Unbekannt';
        const weatherData = {
          temp: current.temp_C,
          feelsLike: current.FeelsLikeC,
          humidity: current.humidity,
          windSpeed: current.windspeedKmph,
          windDir: current.winddir16Point,
          uvIndex: current.uvIndex,
          visibility: current.visibility,
          pressure: current.pressure,
          cloudCover: current.cloudcover,
          weatherDesc,
          precip: current.precipMM,
          city,
          minTemp: today?.mintempC,
          maxTemp: today?.maxtempC,
          sunrise: today?.astronomy?.[0]?.sunrise,
          sunset: today?.astronomy?.[0]?.sunset,
          hourly: hourlyData,
        };

        const wttrUrl = `https://wttr.in/${encodeURIComponent(city)}?lang=de`;
        return {
          results: [
            { id: 'weather-card', title: `${current.temp_C}°C in ${city}`, subtitle: weatherDesc, type: 'weather', path: JSON.stringify(weatherData) },
            { id: 'weather-more', title: 'Vollständige Wettervorschau öffnen', subtitle: `wttr.in/${encodeURIComponent(city)}`, type: 'web', path: wttrUrl, isWeb: true },
          ],
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Wetter nicht abrufbar', subtitle: 'Service nicht verfügbar', type: 'system' }] };
      }
    },
    enabled: true,
    aliases: ['/weather'],
  },
  {
    id: 'weather',
    trigger: '/weather',
    description: 'Wetter abrufen (English)',
    category: 'web',
    requiresSetting: 'features.weatherEnabled',
    async handler(args: string, ctx) {
      const city = args.trim() || ctx.settings.search.defaultCity;
      try {
        const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=de`);
        const data: WttrResponse = await r.json();
        const current = data.current_condition?.[0];
        const today = data.weather?.[0];
        const hourly = today?.hourly || [];

        if (!current) {
          return { results: [{ id: 'cmd-err', title: 'Wetter nicht verfügbar', subtitle: 'Keine Daten erhalten', type: 'system' }] };
        }

        const hourlyData: HourlyData[] = hourly.map((h: WttrHourly) => ({
          time: h.time,
          temp: parseInt(h.tempC),
          feelsLike: parseInt(h.FeelsLikeC),
          chanceOfRain: h.chanceofrain,
          weatherIcon: h.weatherCode,
        }));

        const weatherDesc = current.lang_de?.[0]?.value || current.weatherDesc?.[0]?.value || 'Unbekannt';
        const weatherData = {
          temp: current.temp_C,
          feelsLike: current.FeelsLikeC,
          humidity: current.humidity,
          windSpeed: current.windspeedKmph,
          windDir: current.winddir16Point,
          uvIndex: current.uvIndex,
          visibility: current.visibility,
          pressure: current.pressure,
          cloudCover: current.cloudcover,
          weatherDesc,
          precip: current.precipMM,
          city,
          minTemp: today?.mintempC,
          maxTemp: today?.maxtempC,
          sunrise: today?.astronomy?.[0]?.sunrise,
          sunset: today?.astronomy?.[0]?.sunset,
          hourly: hourlyData,
        };

        const wttrUrl = `https://wttr.in/${encodeURIComponent(city)}?lang=de`;
        return {
          results: [
            { id: 'weather-card', title: `${current.temp_C}°C in ${city}`, subtitle: weatherDesc, type: 'weather', path: JSON.stringify(weatherData) },
            { id: 'weather-more', title: 'Vollständige Wettervorschau öffnen', subtitle: `wttr.in/${encodeURIComponent(city)}`, type: 'web', path: wttrUrl, isWeb: true },
          ],
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Wetter nicht abrufbar', subtitle: 'Service nicht verfügbar', type: 'system' }] };
      }
    },
    enabled: true,
  },
];

export default weatherCommands;
