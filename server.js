/**
 * PDash API Server
 * Mirrors the chatty server pattern (sallespro/chatty) — Express + OpenAI
 * All AI calls run server-side so the OpenAI key is never exposed to the browser.
 */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.API_PORT || 3099;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'gpt-4.1-mini';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ─── Health ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    model: MODEL,
    openai: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────
async function chat(system, user, jsonMode = false) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_tokens: 600,
  });
  return response.choices[0].message.content;
}

// ─── POST /api/intent — AI Intent Parser ─────────────────────────────────
/**
 * Replaces the pattern-based NLU in intentParser.ts.
 * Handles natural, colloquial, and multi-language-style phrases that patterns miss.
 * Input:  { text: string }
 * Output: ParsedIntent JSON
 */
app.post('/api/intent', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const system = `You are a natural language parser for an outdoor activity scheduling assistant.
Parse the user's input and return ONLY a valid JSON object with this exact shape:
{
  "type": "activity_request" | "activity_definition" | "general_query",
  "activity_name": string | null,
  "weather_hints": string[],
  "task_hints": string[],
  "duration_hint": number | null,
  "destination_hint": string | null,
  "raw_text": ""
}

Rules:
- "activity_definition" = user is describing HOW they like to do something (preferences, preparation steps)
  Examples: "I like to ride my bike and have a picnic", "when I surf I need my wetsuit"
- "activity_request" = user wants to schedule or do something NOW/SOON
  Examples: "I want to ride my bike", "find me a good time to surf", "when can I go hiking?"
- "general_query" = everything else (weather questions, greetings, etc.)

activity_name must be one of: "Bike Ride", "Surfing", "Kite Flying", "Hiking", "Running", "Walking", "Picnic"
  — or the literal activity name if it's something new not in that list.
  — null if the activity cannot be identified.

weather_hints: extract relevant conditions the user mentioned.
  Use these normalized values: "no rain", "not too sunny", "windy", "calm", "warm", "cool", "mild"

task_hints: extract preparation or cleanup tasks mentioned.
  Examples: "Prepare picnic", "Check tire pressure", "Get wetsuit ready", "Fill water bottles",
            "Pack gear", "Apply sunscreen", "Wax board", "Charge devices"

duration_hint: integer minutes, or null if not mentioned.

Return ONLY the JSON object, no markdown, no explanation.`;

  try {
    const raw = await chat(system, text, true);
    const parsed = JSON.parse(raw);
    parsed.raw_text = text;
    res.json(parsed);
  } catch (err) {
    console.error('[intent] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/activity-config — AI Activity Auto-Configuration ───────────
/**
 * Given a free-form description of an activity, returns a complete
 * activity configuration: weather profile, task chain, duration estimate.
 * Input:  { description: string, activity_name: string }
 * Output: { weather_profile, task_templates, duration_estimate, notes }
 */
app.post('/api/activity-config', async (req, res) => {
  const { description, activity_name } = req.body;
  if (!description) return res.status(400).json({ error: 'description is required' });

  const system = `You are configuring an outdoor activity scheduling app.
Given a description of an outdoor activity and how the user likes to do it,
return a COMPLETE JSON activity configuration.

Return ONLY a valid JSON object with this exact shape:
{
  "weather_profile": {
    "temperature_min": number,
    "temperature_max": number,
    "wind_speed_min": number,
    "wind_speed_max": number,
    "precipitation_allowed": "none" | "light" | "any",
    "uv_index_max": number,
    "cloud_cover_min": number,
    "cloud_cover_max": number,
    "daylight_required": boolean
  },
  "task_templates": [
    {
      "name": string,
      "type": "preparation" | "cleanup",
      "duration_estimate": number,
      "lead_time": number,
      "notes": string
    }
  ],
  "duration_estimate": number,
  "description": string,
  "notes": string
}

Rules:
- duration_estimate is the main activity duration in minutes (not prep)
- lead_time = how many minutes before activity start this prep task must begin
- For cycling/running: default wind_speed_max 25, temperature 14-32, no rain
- For surfing: needs wind 5-30, temperature 16-35, light rain ok
- For kite flying: needs wind 15-45, no rain
- List only tasks actually mentioned or strongly implied by the description
- If user mentions picnic → add "Prepare picnic" prep task (30 min, lead 90)
- If user mentions bike/bicycle → add "Check tire pressure" prep task (10 min, lead 60)
- lead_time values should be spaced so prep tasks don't overlap`;

  try {
    const raw = await chat(system, `Activity: ${activity_name || 'outdoor activity'}\nDescription: ${description}`, true);
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('[activity-config] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/explain-schedule — AI Schedule Explanation ────────────────
/**
 * Given a proposed schedule and activity, returns a friendly 1-2 sentence
 * explanation of why this time slot is ideal.
 * Input:  { activity_name, weather_snapshot, scheduled_tasks, score_breakdown }
 * Output: { explanation: string, highlight: string }
 */
app.post('/api/explain-schedule', async (req, res) => {
  const { activity_name, weather_snapshot, score_breakdown } = req.body;
  if (!activity_name || !weather_snapshot) {
    return res.status(400).json({ error: 'activity_name and weather_snapshot required' });
  }

  const ws = weather_snapshot;
  const startDate = new Date(ws.start);
  const dayName = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const timeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const context = `Activity: ${activity_name}
Date: ${dayName} starting around ${timeStr}
Temperature: ${Math.round(ws.avg_temperature)}°C
Wind: ${Math.round(ws.avg_wind_speed)} km/h
Precipitation: ${ws.max_precipitation} mm
UV Index: ${ws.avg_uv_index?.toFixed(1) || 'n/a'}
Cloud cover: ${Math.round(ws.avg_cloud_cover)}%
Weather score: ${Math.round((score_breakdown?.weather || 0) * 100)}%
Time-of-day score: ${Math.round((score_breakdown?.time || 0) * 100)}%`;

  const system = `You are a friendly outdoor activity assistant.
Write exactly 2 sentences explaining why this weather window is a good (or challenging) time for the activity.
Be specific about the weather conditions. Be encouraging but honest.
Return ONLY a JSON object: { "explanation": "...", "highlight": "one key reason in 4-6 words" }`;

  try {
    const raw = await chat(system, context, true);
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('[explain-schedule] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/window-verdict — AI Weather Window Verdict ─────────────────
/**
 * Analyzes whether a weather window matches an activity's profile and why.
 * Input:  { activity_name, weather_profile, window_stats }
 * Output: { verdict: "good"|"ok"|"marginal", reason: string, tips: string[] }
 */
app.post('/api/window-verdict', async (req, res) => {
  const { activity_name, weather_profile, window_stats } = req.body;
  if (!activity_name || !weather_profile || !window_stats) {
    return res.status(400).json({ error: 'activity_name, weather_profile, window_stats required' });
  }

  const system = `You are a weather analyst for outdoor activities.
Evaluate how well the weather window matches the activity requirements.
Return ONLY a JSON object:
{
  "verdict": "good" | "ok" | "marginal",
  "reason": "one sentence explanation",
  "tips": ["up to 2 short practical tips"]
}`;

  const user = `Activity: ${activity_name}
Acceptable range: ${weather_profile.temperature_min}-${weather_profile.temperature_max}°C, wind ${weather_profile.wind_speed_min}-${weather_profile.wind_speed_max} km/h, rain: ${weather_profile.precipitation_allowed}
Actual conditions: ${window_stats.avg_temperature?.toFixed(1)}°C, wind ${window_stats.avg_wind_speed?.toFixed(1)} km/h, precipitation ${window_stats.max_precipitation} mm, UV ${window_stats.avg_uv_index?.toFixed(1)}`;

  try {
    const raw = await chat(system, user, true);
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('[window-verdict] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/weather/current — Current weather via OpenWeatherMap ────────
/**
 * Proxies to https://api.openweathermap.org/data/2.5/weather
 * Keeps OPENWEATHER_API_KEY server-side.
 * Query params: lat, lon
 */
app.get('/api/weather/current', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENWEATHER_API_KEY not configured' });

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: `OpenWeatherMap error: ${r.status}` });
    res.json(await r.json());
  } catch (err) {
    console.error('[weather/current] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/weather/forecast — 5-day/3-hour forecast via OpenWeatherMap ─
/**
 * Proxies to https://api.openweathermap.org/data/2.5/forecast
 * Keeps OPENWEATHER_API_KEY server-side.
 * Query params: lat, lon
 */
app.get('/api/weather/forecast', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENWEATHER_API_KEY not configured' });

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: `OpenWeatherMap error: ${r.status}` });
    res.json(await r.json());
  } catch (err) {
    console.error('[weather/forecast] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/activity-posts — Dynamic activity ticker posts by location ─
/**
 * Generates (and caches for 3h) best-window posts for Bike Ride activity.
 * Query params: lat, lon  (required for location-relative posts)
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory post cache: key = "lat,lon" → { data, fetched }
const postCache = new Map();
const POST_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

const BIKE_PROFILE = {
  temperature_min: 14, temperature_max: 32,
  wind_speed_max: 25, precipitation_allowed: 'none',
  uv_index_max: 8, daylight_required: true,
};

function _owmToCode(id) {
  if (id === 800) return 0;
  if (id >= 801 && id <= 804) return id - 799;
  if (id >= 200 && id <= 232) return 95;
  if (id >= 300 && id <= 321) return 51;
  if (id >= 500 && id <= 531) return 61;
  if (id >= 600 && id <= 622) return 71;
  if (id >= 700 && id <= 781) return 45;
  return 0;
}

function _codeLabel(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Unknown';
}

function _estUv(clouds, isDay) {
  if (!isDay) return 0;
  if (clouds >= 80) return 1;
  if (clouds >= 50) return 3;
  if (clouds >= 20) return 5;
  return 7;
}

function _matchesProfile(h, p) {
  if (h.temperature < p.temperature_min || h.temperature > p.temperature_max) return false;
  if (h.wind_speed > p.wind_speed_max) return false;
  if (p.precipitation_allowed === 'none' && (h.pop > 0.25 || h.precipitation > 0.1)) return false;
  if (h.uv_index > p.uv_index_max) return false;
  if (p.daylight_required && !h.is_day) return false;
  return true;
}

function _buildWindow(hours) {
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mid = hours[Math.floor(hours.length / 2)];
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
    weather_code: mid.weather_code,
    description: mid.description,
  };
}

function _findWindows(hours, minHours = 2) {
  const windows = [];
  let run = [];
  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    const prev = i > 0 ? hours[i - 1] : null;
    if (prev && h.time.getDate() !== prev.time.getDate() && run.length > 0) {
      if (run.length >= minHours) windows.push(_buildWindow(run));
      run = [];
    }
    if (_matchesProfile(h, BIKE_PROFILE)) { run.push(h); }
    else { if (run.length >= minHours) windows.push(_buildWindow(run)); run = []; }
  }
  if (run.length >= minHours) windows.push(_buildWindow(run));
  return windows;
}

function _scoreWindow(w) {
  const p = BIKE_PROFILE;
  const tempRange = p.temperature_max - p.temperature_min;
  const tempNorm = tempRange > 0 ? (w.avg_temperature - p.temperature_min) / tempRange : 0.5;
  const tempScore = Math.max(0, 1 - Math.abs(tempNorm - 0.55) / 0.45);
  const windScore = Math.max(0, 1 - Math.pow(w.avg_wind_speed / p.wind_speed_max, 2));
  const uvScore = Math.max(0, 1 - w.avg_uv_index / p.uv_index_max);
  const precipScore = Math.max(0, 1 - w.avg_pop) * (w.max_precipitation < 0.5 ? 1 : 0.6);
  const weatherScore = (tempScore + windScore + uvScore + precipScore) / 4;
  const startHour = w.start.getHours();
  const minDist = Math.min(...[9, 10, 15, 16].map(h => Math.abs(startHour - h)));
  const timeScore = Math.max(0, 1 - minDist / 6);
  const durationHours = (w.end - w.start) / 3600000;
  const convenienceScore = Math.min(1, durationHours / 6);
  return {
    composite: 0.5 * weatherScore + 0.3 * timeScore + 0.2 * convenienceScore,
    weather: weatherScore, time: timeScore,
  };
}

async function _generatePostBody(w, score, city) {
  const start = w.start;
  const dayName = start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const endStr = w.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const durationH = ((w.end - w.start) / 3600000).toFixed(1);

  const prompt = `You are a concise outdoor activity weather analyst for a dashboard ticker widget.
Write a short weather analysis (2-3 sentences, max 120 words) for a Bike Ride opportunity.
Location: ${city}
Date: ${dayName}
Window: ${timeStr} – ${endStr} (${durationH}h)
Temperature: ${w.avg_temperature.toFixed(1)}°C  Wind: ${w.avg_wind_speed.toFixed(1)} km/h
Conditions: ${w.description || _codeLabel(w.weather_code)}  Cloud: ${Math.round(w.avg_cloud_cover)}%
UV: ${w.avg_uv_index.toFixed(1)}  Rain prob: ${Math.round(w.avg_pop * 100)}%
Overall score: ${Math.round(score.composite * 100)}/100
Be specific. Start with a verdict word (Excellent/Good/Decent/Fair). Keep it punchy.`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 200,
  });
  return res.choices[0].message.content.trim();
}

async function generateActivityPosts(lat, lon) {
  const key = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
  const cached = postCache.get(key);
  if (cached && Date.now() - cached.fetched < POST_CACHE_TTL) return cached.data;

  const owmKey = process.env.OPENWEATHER_API_KEY;
  const owmUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric`;
  const owmRes = await fetch(owmUrl);
  if (!owmRes.ok) throw new Error(`OWM error: ${owmRes.status}`);
  const owmJson = await owmRes.json();
  const city = owmJson.city?.name || 'your location';

  // Expand 3h slots → hourly entries
  const hours = [];
  for (const slot of owmJson.list) {
    const slotTime = new Date(slot.dt * 1000);
    const wind_speed = slot.wind.speed * 3.6;
    const precipitation = (slot.rain?.['3h'] ?? slot.snow?.['3h'] ?? 0) / 3;
    const cloud_cover = slot.clouds.all;
    const is_day = slot.sys?.pod === 'd';
    for (let off = 0; off < 3; off++) {
      hours.push({
        time: new Date(slotTime.getTime() + off * 3600000),
        temperature: slot.main.temp,
        wind_speed,
        precipitation,
        pop: slot.pop ?? 0,
        uv_index: _estUv(cloud_cover, is_day),
        cloud_cover,
        weather_code: _owmToCode(slot.weather[0]?.id ?? 800),
        description: slot.weather[0]?.description ?? '',
        is_day,
      });
    }
  }

  const windows = _findWindows(hours, 2);
  if (windows.length === 0) {
    const empty = [{ id: 'no-windows', title: 'No ideal windows found',
      body: `Weather conditions over the next 5 days in ${city} don't match ideal Bike Ride requirements. Check back later!`,
      activity: 'Bike Ride', score: 0, temperature: 0, wind: 0,
      condition: 'N/A', conditionCode: 0, startTime: new Date().toISOString(),
      endTime: new Date().toISOString(), city, timestamp: new Date().toISOString() }];
    postCache.set(key, { data: empty, fetched: Date.now() });
    return empty;
  }

  const scored = windows.map(w => ({ w, s: _scoreWindow(w) }))
    .sort((a, b) => b.s.composite - a.s.composite)
    .slice(0, 5);

  const posts = [];
  for (let i = 0; i < scored.length; i++) {
    const { w, s } = scored[i];
    const start = w.start;
    const dayLabel = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endLabel = w.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    let body;
    try { body = await _generatePostBody(w, s, city); }
    catch { body = `${Math.round(w.avg_temperature)}°C, wind ${Math.round(w.avg_wind_speed)} km/h, ${_codeLabel(w.weather_code)}. Score: ${Math.round(s.composite * 100)}/100.`; }
    posts.push({
      id: `bike-ride-${i}`,
      title: `${dayLabel} · ${timeLabel} – ${endLabel}`,
      body,
      activity: 'Bike Ride',
      score: Math.round(s.composite * 100),
      temperature: Math.round(w.avg_temperature),
      wind: Math.round(w.avg_wind_speed),
      condition: _codeLabel(w.weather_code),
      conditionCode: w.weather_code,
      startTime: w.start.toISOString(),
      endTime: w.end.toISOString(),
      city,
      timestamp: new Date().toISOString(),
    });
  }

  postCache.set(key, { data: posts, fetched: Date.now() });
  return posts;
}

app.get('/api/activity-posts', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.json([]);
  if (!process.env.OPENWEATHER_API_KEY) return res.status(500).json({ error: 'OPENWEATHER_API_KEY not configured' });
  try {
    const posts = await generateActivityPosts(lat, lon);
    res.json(posts);
  } catch (err) {
    console.error('[activity-posts] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌤  PDash API server → http://localhost:${PORT}`);
  console.log(`   POST /api/intent           — AI intent parsing`);
  console.log(`   POST /api/activity-config  — AI activity auto-config`);
  console.log(`   POST /api/explain-schedule — AI schedule explanation`);
  console.log(`   POST /api/window-verdict   — AI weather verdict`);
  console.log(`   GET  /api/weather/current  — current weather (OpenWeatherMap)`);
  console.log(`   GET  /api/weather/forecast — 5-day/3h forecast (OpenWeatherMap)`);
  console.log(`   GET  /api/activity-posts   — activity ticker posts`);
  console.log(`   OpenAI key:       ${process.env.OPENAI_API_KEY ? '✓ loaded' : '✗ MISSING'}`);
  console.log(`   OpenWeather key:  ${process.env.OPENWEATHER_API_KEY ? '✓ loaded' : '✗ MISSING'}`);
});
