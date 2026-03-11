import type { HourlyWeather, WeatherProfile, OpportunityWindow, Location } from '../types';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cachedForecast: { data: HourlyWeather[]; fetched: number; key: string } | null = null;

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/** Map OpenWeatherMap weather condition ID to a WMO-compatible weather code. */
function owmIdToWeatherCode(id: number): number {
  if (id === 800) return 0;          // clear sky
  if (id >= 801 && id <= 804) return id - 799; // 1–4 = partly/mostly cloudy, overcast
  if (id >= 200 && id <= 232) return 95;       // thunderstorm
  if (id >= 300 && id <= 321) return 51;       // drizzle
  if (id >= 500 && id <= 531) return 61;       // rain
  if (id >= 600 && id <= 622) return 71;       // snow
  if (id >= 700 && id <= 781) return 45;       // atmosphere (fog, haze, etc.)
  return 0;
}

/** Estimate UV index from cloud cover percentage (rough approximation). */
function estimateUvIndex(cloudCover: number, isDaytime: boolean): number {
  if (!isDaytime) return 0;
  if (cloudCover >= 80) return 1;
  if (cloudCover >= 50) return 3;
  if (cloudCover >= 20) return 5;
  return 7;
}

export async function fetchForecast(location: Location): Promise<HourlyWeather[]> {
  const key = cacheKey(location.lat, location.lng);
  if (cachedForecast && cachedForecast.key === key && Date.now() - cachedForecast.fetched < CACHE_TTL) {
    return cachedForecast.data;
  }

  const res = await fetch(`/api/weather/forecast?lat=${location.lat}&lon=${location.lng}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();

  // OpenWeatherMap /forecast returns 3-hour intervals; each entry is one slot.
  // We interpolate each slot into 3 hourly entries to maintain hourly granularity.
  const hours: HourlyWeather[] = [];

  for (const slot of json.list) {
    const slotTime = new Date(slot.dt * 1000);
    const temperature: number = slot.main.temp;
    const wind_speed: number = slot.wind.speed * 3.6; // m/s → km/h
    const wind_direction: number = slot.wind.deg ?? 0;
    const rain3h: number = slot.rain?.['3h'] ?? slot.snow?.['3h'] ?? 0;
    const precipitation: number = rain3h / 3; // distribute evenly as mm/hour
    const pop: number = slot.pop ?? 0;         // probability of precipitation 0–1
    const cloud_cover: number = slot.clouds.all;
    const isDaytime: boolean = slot.sys?.pod === 'd';
    const uv_index: number = estimateUvIndex(cloud_cover, isDaytime);
    const weather_code: number = owmIdToWeatherCode(slot.weather[0]?.id ?? 800);

    // Expand each 3-hour slot into 3 hourly entries (t+0h, t+1h, t+2h)
    for (let offset = 0; offset < 3; offset++) {
      hours.push({
        time: new Date(slotTime.getTime() + offset * 60 * 60 * 1000),
        temperature,
        wind_speed,
        wind_direction,
        precipitation,
        pop,
        uv_index,
        cloud_cover,
        weather_code,
        is_day: isDaytime,
      });
    }
  }

  cachedForecast = { data: hours, fetched: Date.now(), key };
  return hours;
}

export function hourMatchesProfile(hour: HourlyWeather, profile: WeatherProfile): boolean {
  if (hour.temperature < profile.temperature_min || hour.temperature > profile.temperature_max) return false;
  if (hour.wind_speed < profile.wind_speed_min || hour.wind_speed > profile.wind_speed_max) return false;

  // Use probability of precipitation (pop) as primary rain signal,
  // with actual mm/h as a secondary check for intensity.
  if (profile.precipitation_allowed === 'none') {
    if (hour.pop > 0.25) return false;       // >25% chance of any rain
    if (hour.precipitation > 0.1) return false; // or measurable rain already
  }
  if (profile.precipitation_allowed === 'light') {
    if (hour.pop > 0.65) return false;       // >65% chance of significant rain
    if (hour.precipitation > 1.5) return false; // or sustained heavy rain (mm/h)
  }
  // 'any' — no precipitation check

  if (hour.uv_index > profile.uv_index_max) return false;
  if (hour.cloud_cover < profile.cloud_cover_min || hour.cloud_cover > profile.cloud_cover_max) return false;
  if (profile.daylight_required && !hour.is_day) return false;
  return true;
}

export function findOpportunityWindows(
  forecast: HourlyWeather[],
  profile: WeatherProfile,
  minDurationMinutes: number
): OpportunityWindow[] {
  const windows: OpportunityWindow[] = [];
  let currentRun: HourlyWeather[] = [];

  for (let i = 0; i < forecast.length; i++) {
    const hour = forecast[i];
    const prev = i > 0 ? forecast[i - 1] : null;

    // Break run at calendar day boundaries to ensure per-day proposals
    const crossesMidnight = prev != null && hour.time.getDate() !== prev.time.getDate();
    if (crossesMidnight && currentRun.length > 0) {
      maybeAddWindow(currentRun, minDurationMinutes, windows);
      currentRun = [];
    }

    if (hourMatchesProfile(hour, profile)) {
      currentRun.push(hour);
    } else {
      if (currentRun.length > 0) {
        maybeAddWindow(currentRun, minDurationMinutes, windows);
        currentRun = [];
      }
    }
  }
  if (currentRun.length > 0) {
    maybeAddWindow(currentRun, minDurationMinutes, windows);
  }

  return windows;
}

function maybeAddWindow(hours: HourlyWeather[], minMinutes: number, windows: OpportunityWindow[]) {
  const durationMinutes = hours.length * 60;
  if (durationMinutes >= minMinutes) {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    windows.push({
      start: hours[0].time,
      end: new Date(hours[hours.length - 1].time.getTime() + 60 * 60 * 1000),
      hours,
      avg_temperature: avg(hours.map(h => h.temperature)),
      avg_wind_speed: avg(hours.map(h => h.wind_speed)),
      max_precipitation: Math.max(...hours.map(h => h.precipitation)),
      avg_uv_index: avg(hours.map(h => h.uv_index)),
      avg_cloud_cover: avg(hours.map(h => h.cloud_cover)),
    });
  }
}

export function scoreWindow(window: OpportunityWindow, profile: WeatherProfile): {
  weather: number;
  time: number;
  convenience: number;
  composite: number;
} {
  // Temperature: score 1.0 if in the comfortable inner 60% of the range, falls off toward edges
  const tempRange = profile.temperature_max - profile.temperature_min;
  const tempNorm = tempRange > 0
    ? (window.avg_temperature - profile.temperature_min) / tempRange // 0–1 within range
    : 0.5;
  // Peak score at 40–70% of range (slightly warm side), not dead center
  const tempScore = Math.max(0, 1 - Math.abs(tempNorm - 0.55) / 0.45);

  // Wind: prefer calm-to-mid range; penalise approaching the maximum
  const windRange = profile.wind_speed_max - profile.wind_speed_min;
  const windNorm = windRange > 0
    ? (window.avg_wind_speed - profile.wind_speed_min) / windRange
    : 0.5;
  const windScore = Math.max(0, 1 - Math.pow(windNorm, 2)); // smooth falloff toward max

  // UV: lower is better (1.0 at UV=0, 0 at uv_index_max)
  const uvScore = Math.max(0, 1 - window.avg_uv_index / profile.uv_index_max);

  // Precipitation: use avg pop and max mm/h for a combined score
  const avgPop = window.hours.reduce((s, h) => s + h.pop, 0) / window.hours.length;
  const precipScore = Math.max(0, 1 - avgPop) * (window.max_precipitation < 0.5 ? 1 : 0.6);

  const weatherScore = (tempScore + windScore + uvScore + precipScore) / 4;

  // Time score: prefer mid-morning (9-11) and late-afternoon (15-17)
  const startHour = window.start.getHours();
  const idealHours = [9, 10, 15, 16];
  const minDist = Math.min(...idealHours.map(h => Math.abs(startHour - h)));
  const timeScore = Math.max(0, 1 - minDist / 6);

  // Convenience: longer windows are better (more flexibility)
  const durationHours = (window.end.getTime() - window.start.getTime()) / (1000 * 60 * 60);
  const convenienceScore = Math.min(1, durationHours / 6);

  const composite = 0.5 * weatherScore + 0.3 * timeScore + 0.2 * convenienceScore;

  return { weather: weatherScore, time: timeScore, convenience: convenienceScore, composite };
}

export function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Unknown';
}

export function weatherCodeToIcon(code: number): string {
  if (code === 0) return 'sun';
  if (code <= 3) return 'cloud-sun';
  if (code <= 49) return 'cloud-fog';
  if (code <= 69) return 'cloud-rain';
  if (code <= 79) return 'snowflake';
  if (code <= 86) return 'snowflake';
  if (code >= 95) return 'cloud-lightning';
  return 'cloud';
}
