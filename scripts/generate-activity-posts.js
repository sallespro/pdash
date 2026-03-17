#!/usr/bin/env node
/**
 * generate-activity-posts.js
 *
 * Fetches weather forecast data and uses OpenAI to produce "best moment" posts
 * for outdoor activities (default: Bike Ride). Each post contains:
 *   - title: proposed date & time
 *   - body: weather condition analysis
 *
 * Output: writes JSON array to ../public/activity-posts.json
 *
 * Usage:
 *   node scripts/generate-activity-posts.js [--activity "Bike Ride"] [--lat 37.77] [--lon -122.42]
 *
 * Requires: OPENWEATHER_API_KEY and OPENAI_API_KEY in .env
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENWEATHER_KEY) { console.error('Missing OPENWEATHER_API_KEY'); process.exit(1); }
if (!OPENAI_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const ACTIVITY = getArg('--activity', 'Bike Ride');

async function detectLocation() {
  const latArg = getArg('--lat', null);
  const lonArg = getArg('--lon', null);
  if (latArg && lonArg) return { lat: parseFloat(latArg), lon: parseFloat(lonArg), source: 'args' };

  // Auto-detect via IP geolocation (free, no key needed)
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const j = await res.json();
      if (j.latitude && j.longitude) {
        console.log(`Auto-detected location: ${j.city}, ${j.country_name} (${j.latitude}, ${j.longitude})`);
        return { lat: j.latitude, lon: j.longitude, source: 'ip' };
      }
    }
  } catch { /* ignore */ }

  // Final fallback — Florianópolis, SC, Brazil
  console.warn('Could not detect location, using Florianópolis. Pass --lat / --lon to override.');
  return { lat: -27.5954, lon: -48.548, source: 'fallback' };
}

const { lat: LAT, lon: LON } = await detectLocation();

// Bike ride weather profile
const PROFILES = {
  'Bike Ride': {
    temperature_min: 14, temperature_max: 32,
    wind_speed_max: 25, precipitation_allowed: 'none',
    uv_index_max: 8, daylight_required: true,
  },
  'Running': {
    temperature_min: 10, temperature_max: 30,
    wind_speed_max: 30, precipitation_allowed: 'none',
    uv_index_max: 9, daylight_required: true,
  },
  'Hiking': {
    temperature_min: 8, temperature_max: 35,
    wind_speed_max: 35, precipitation_allowed: 'light',
    uv_index_max: 10, daylight_required: true,
  },
};

const profile = PROFILES[ACTIVITY] || PROFILES['Bike Ride'];

// ── Helpers ──────────────────────────────────────────────────────────────

function owmIdToWeatherCode(id) {
  if (id === 800) return 0;
  if (id >= 801 && id <= 804) return id - 799;
  if (id >= 200 && id <= 232) return 95;
  if (id >= 300 && id <= 321) return 51;
  if (id >= 500 && id <= 531) return 61;
  if (id >= 600 && id <= 622) return 71;
  if (id >= 700 && id <= 781) return 45;
  return 0;
}

function weatherCodeToLabel(code) {
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

function estimateUv(clouds, isDay) {
  if (!isDay) return 0;
  if (clouds >= 80) return 1;
  if (clouds >= 50) return 3;
  if (clouds >= 20) return 5;
  return 7;
}

function hourMatchesProfile(h, p) {
  if (h.temperature < p.temperature_min || h.temperature > p.temperature_max) return false;
  if (h.wind_speed > p.wind_speed_max) return false;
  if (p.precipitation_allowed === 'none' && (h.pop > 0.25 || h.precipitation > 0.1)) return false;
  if (p.precipitation_allowed === 'light' && (h.pop > 0.65 || h.precipitation > 1.5)) return false;
  if (h.uv_index > p.uv_index_max) return false;
  if (p.daylight_required && !h.is_day) return false;
  return true;
}

// ── Fetch forecast ───────────────────────────────────────────────────────

async function fetchForecast() {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();

  const hours = [];
  for (const slot of json.list) {
    const slotTime = new Date(slot.dt * 1000);
    const temperature = slot.main.temp;
    const wind_speed = slot.wind.speed * 3.6;
    const wind_direction = slot.wind.deg ?? 0;
    const rain3h = slot.rain?.['3h'] ?? slot.snow?.['3h'] ?? 0;
    const precipitation = rain3h / 3;
    const pop = slot.pop ?? 0;
    const cloud_cover = slot.clouds.all;
    const is_day = slot.sys?.pod === 'd';
    const uv_index = estimateUv(cloud_cover, is_day);
    const weather_code = owmIdToWeatherCode(slot.weather[0]?.id ?? 800);
    const description = slot.weather[0]?.description ?? '';

    for (let offset = 0; offset < 3; offset++) {
      hours.push({
        time: new Date(slotTime.getTime() + offset * 3600000),
        temperature, wind_speed, wind_direction,
        precipitation, pop, uv_index, cloud_cover,
        weather_code, is_day, description,
      });
    }
  }
  return { hours, city: json.city?.name || 'Unknown' };
}

// ── Find opportunity windows ────────────────────────────────────────────

function findWindows(hours, minHours = 1) {
  const windows = [];
  let run = [];

  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    const prev = i > 0 ? hours[i - 1] : null;
    const crossesMidnight = prev && h.time.getDate() !== prev.time.getDate();

    if (crossesMidnight && run.length > 0) {
      if (run.length >= minHours) windows.push(buildWindow(run));
      run = [];
    }

    if (hourMatchesProfile(h, profile)) {
      run.push(h);
    } else {
      if (run.length >= minHours) windows.push(buildWindow(run));
      run = [];
    }
  }
  if (run.length >= minHours) windows.push(buildWindow(run));
  return windows;
}

function buildWindow(hours) {
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    start: hours[0].time,
    end: new Date(hours[hours.length - 1].time.getTime() + 3600000),
    hours,
    avg_temperature: avg(hours.map(h => h.temperature)),
    avg_wind_speed: avg(hours.map(h => h.wind_speed)),
    max_precipitation: Math.max(...hours.map(h => h.precipitation)),
    avg_uv_index: avg(hours.map(h => h.uv_index)),
    avg_cloud_cover: avg(hours.map(h => h.cloud_cover)),
    avg_pop: avg(hours.map(h => h.pop)),
    primary_condition: hours[Math.floor(hours.length / 2)].description,
    weather_code: hours[Math.floor(hours.length / 2)].weather_code,
  };
}

// ── Score windows ────────────────────────────────────────────────────────

function scoreWindow(w) {
  const tempRange = profile.temperature_max - profile.temperature_min;
  const tempNorm = tempRange > 0 ? (w.avg_temperature - profile.temperature_min) / tempRange : 0.5;
  const tempScore = Math.max(0, 1 - Math.abs(tempNorm - 0.55) / 0.45);

  const windScore = Math.max(0, 1 - Math.pow(w.avg_wind_speed / profile.wind_speed_max, 2));
  const uvScore = Math.max(0, 1 - w.avg_uv_index / profile.uv_index_max);
  const precipScore = Math.max(0, 1 - w.avg_pop) * (w.max_precipitation < 0.5 ? 1 : 0.6);
  const weatherScore = (tempScore + windScore + uvScore + precipScore) / 4;

  const startHour = w.start.getHours();
  const idealHours = [9, 10, 15, 16];
  const minDist = Math.min(...idealHours.map(h => Math.abs(startHour - h)));
  const timeScore = Math.max(0, 1 - minDist / 6);

  const durationHours = (w.end.getTime() - w.start.getTime()) / 3600000;
  const convenienceScore = Math.min(1, durationHours / 6);

  return {
    composite: 0.5 * weatherScore + 0.3 * timeScore + 0.2 * convenienceScore,
    weather: weatherScore, time: timeScore, convenience: convenienceScore,
  };
}

// ── Generate post text with OpenAI ───────────────────────────────────────

async function generatePostBody(window, score, city) {
  const start = window.start;
  const dayName = start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const endStr = window.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const durationH = ((window.end - window.start) / 3600000).toFixed(1);

  const prompt = `You are a concise outdoor activity weather analyst for a dashboard ticker widget.
Write a short weather analysis (2-3 sentences, max 120 words) for a ${ACTIVITY} opportunity.

Location: ${city}
Date: ${dayName}
Window: ${timeStr} – ${endStr} (${durationH}h)
Temperature: ${window.avg_temperature.toFixed(1)}°C
Wind: ${window.avg_wind_speed.toFixed(1)} km/h
Conditions: ${window.primary_condition || weatherCodeToLabel(window.weather_code)}
Cloud cover: ${Math.round(window.avg_cloud_cover)}%
UV Index: ${window.avg_uv_index.toFixed(1)}
Rain probability: ${Math.round(window.avg_pop * 100)}%
Weather score: ${Math.round(score.weather * 100)}/100
Overall score: ${Math.round(score.composite * 100)}/100

Be specific about conditions. Mention temperature feel, wind impact on cycling, and visibility.
Start with a verdict word (Excellent/Good/Decent/Fair). Keep it punchy.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json.choices[0].message.content.trim();
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Generating ${ACTIVITY} posts for (${LAT}, ${LON})...`);

  const { hours, city } = await fetchForecast();
  console.log(`Fetched ${hours.length} hourly entries for ${city}`);

  const windows = findWindows(hours, 2); // at least 2h windows
  console.log(`Found ${windows.length} opportunity windows`);

  if (windows.length === 0) {
    console.log('No suitable windows found. Writing empty posts.');
    writeOutput([{
      id: 'no-windows',
      title: 'No ideal windows found',
      body: `Weather conditions over the next 5 days don't match ideal ${ACTIVITY} requirements. Check back later!`,
      activity: ACTIVITY,
      score: 0,
      timestamp: new Date().toISOString(),
    }]);
    return;
  }

  // Score and sort, take top 5
  const scored = windows.map(w => ({ window: w, score: scoreWindow(w) }));
  scored.sort((a, b) => b.score.composite - a.score.composite);
  const top = scored.slice(0, 5);

  console.log(`Generating AI analysis for top ${top.length} windows...`);

  const posts = [];
  for (let i = 0; i < top.length; i++) {
    const { window: w, score } = top[i];
    const start = w.start;
    const dayLabel = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endLabel = w.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const title = `${dayLabel} · ${timeLabel} – ${endLabel}`;
    console.log(`  [${i + 1}/${top.length}] ${title} (score: ${Math.round(score.composite * 100)})`);

    let body;
    try {
      body = await generatePostBody(w, score, city);
    } catch (err) {
      console.error(`  AI generation failed: ${err.message}`);
      body = `${Math.round(w.avg_temperature)}°C, wind ${Math.round(w.avg_wind_speed)} km/h, ${weatherCodeToLabel(w.weather_code)}. Score: ${Math.round(score.composite * 100)}/100.`;
    }

    posts.push({
      id: `${ACTIVITY.toLowerCase().replace(/\s+/g, '-')}-${i}`,
      title,
      body,
      activity: ACTIVITY,
      score: Math.round(score.composite * 100),
      temperature: Math.round(w.avg_temperature),
      wind: Math.round(w.avg_wind_speed),
      condition: weatherCodeToLabel(w.weather_code),
      conditionCode: w.weather_code,
      startTime: w.start.toISOString(),
      endTime: w.end.toISOString(),
      city,
      timestamp: new Date().toISOString(),
    });
  }

  writeOutput(posts);
  console.log(`Done! Generated ${posts.length} posts.`);
}

function writeOutput(posts) {
  const outPath = join(__dirname, '..', 'public', 'activity-posts.json');
  writeFileSync(outPath, JSON.stringify(posts, null, 2));
  console.log(`Written to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
