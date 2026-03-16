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

// ─── GET /api/activity-posts — Serve generated activity ticker posts ─────
/**
 * Returns pre-generated activity posts from public/activity-posts.json.
 * Run `node scripts/generate-activity-posts.js` to refresh the data.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get('/api/activity-posts', (req, res) => {
  try {
    const postsPath = path.join(__dirname, 'public', 'activity-posts.json');
    const data = readFileSync(postsPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('[activity-posts] Error:', err.message);
    res.json([]);
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
