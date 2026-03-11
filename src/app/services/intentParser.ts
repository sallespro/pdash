import type { ParsedIntent } from '../types';
import { parseIntentAI } from './aiClient';

// Pattern-based NLU for activity definitions and requests

const REQUEST_PATTERNS = [
  /i want to (.+)/i,
  /i'd like to (.+)/i,
  /let's (.+)/i,
  /can i (.+)/i,
  /schedule (.+)/i,
  /plan (?:a |my )?(.+)/i,
  /when can i (.+)/i,
  /find (?:a )?time (?:to |for )(.+)/i,
];

const DEFINITION_PATTERNS = [
  /i like to (.+)/i,
  /when i (.+?) i (?:usually|also|need|want|like)/i,
  /for (?:my |a )?(.+?) i (?:need|want|like|usually|prefer)/i,
];

const WEATHER_KEYWORDS: Record<string, string[]> = {
  'no rain': ['no rain', 'not rainy', 'dry', 'without rain', 'no precipitation'],
  'not too sunny': ['not too sunny', 'not blazing', 'partly cloudy', 'some shade', 'moderate sun'],
  'windy': ['windy', 'wind', 'breezy', 'good wind'],
  'calm': ['calm', 'no wind', 'still', 'not windy'],
  'warm': ['warm', 'hot', 'heated'],
  'cool': ['cool', 'mild', 'not too hot'],
};

const TASK_KEYWORDS: Record<string, string> = {
  'picnic': 'Prepare picnic',
  'pack': 'Pack gear',
  'lunch': 'Prepare lunch',
  'snack': 'Prepare snacks',
  'sunscreen': 'Apply sunscreen',
  'tire': 'Check tire pressure',
  'gear': 'Prepare gear',
  'wax': 'Wax board',
  'wetsuit': 'Get wetsuit ready',
  'charge': 'Charge devices',
  'water': 'Fill water bottles',
  'map': 'Check route/map',
};

const ACTIVITY_SYNONYMS: Record<string, string> = {
  'ride my bike': 'Bike Ride',
  'ride a bike': 'Bike Ride',
  'bike ride': 'Bike Ride',
  'bike': 'Bike Ride',
  'cycling': 'Bike Ride',
  'cycle': 'Bike Ride',
  'bicycle': 'Bike Ride',
  'surf': 'Surfing',
  'surfing': 'Surfing',
  'go surfing': 'Surfing',
  'fly a kite': 'Kite Flying',
  'kite flying': 'Kite Flying',
  'kite': 'Kite Flying',
  'fly': 'Kite Flying',
  'hike': 'Hiking',
  'hiking': 'Hiking',
  'go hiking': 'Hiking',
  'walk': 'Walking',
  'go for a walk': 'Walking',
  'run': 'Running',
  'running': 'Running',
  'go running': 'Running',
  'jog': 'Running',
  'jogging': 'Running',
  'picnic': 'Picnic',
  'go for a picnic': 'Picnic',
};

const DURATION_PATTERNS = [
  /(\d+)\s*hours?/i,
  /(\d+)\s*minutes?/i,
  /about\s*(\d+)\s*h/i,
];

/**
 * AI-powered intent parsing with pattern-matching fallback.
 * Tries the local API server first; falls back to regex patterns if unavailable.
 */
export async function parseIntentAsync(text: string): Promise<ParsedIntent> {
  const aiResult = await parseIntentAI(text);
  if (aiResult) return aiResult as ParsedIntent;
  return parseIntent(text); // fallback
}

export function parseIntent(text: string): ParsedIntent {
  const lower = text.toLowerCase().trim();

  // Check for activity definition first
  for (const pattern of DEFINITION_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      return buildIntent('activity_definition', text, lower);
    }
  }

  // Check for activity request
  for (const pattern of REQUEST_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      return buildIntent('activity_request', text, lower);
    }
  }

  // Fallback: if we detect an activity name, treat as request
  for (const [synonym, name] of Object.entries(ACTIVITY_SYNONYMS)) {
    if (lower.includes(synonym)) {
      return buildIntent('activity_request', text, lower);
    }
  }

  return { type: 'general_query', raw_text: text };
}

function buildIntent(type: 'activity_definition' | 'activity_request', raw: string, lower: string): ParsedIntent {
  const intent: ParsedIntent = { type, raw_text: raw };

  // Extract activity name
  for (const [synonym, name] of Object.entries(ACTIVITY_SYNONYMS)) {
    if (lower.includes(synonym)) {
      intent.activity_name = name;
      break;
    }
  }

  // Extract weather hints
  const weatherHints: string[] = [];
  for (const [hint, keywords] of Object.entries(WEATHER_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      weatherHints.push(hint);
    }
  }
  if (weatherHints.length > 0) intent.weather_hints = weatherHints;

  // Extract task hints
  const taskHints: string[] = [];
  for (const [keyword, taskName] of Object.entries(TASK_KEYWORDS)) {
    if (lower.includes(keyword)) {
      taskHints.push(taskName);
    }
  }
  if (taskHints.length > 0) intent.task_hints = taskHints;

  // Extract duration
  for (const pattern of DURATION_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const val = parseInt(match[1]);
      intent.duration_hint = pattern.source.includes('hour') ? val * 60 : val;
      break;
    }
  }

  return intent;
}

export function inferWeatherProfile(hints: string[]): Partial<import('../types').WeatherProfile> {
  const profile: Partial<import('../types').WeatherProfile> = {};

  for (const hint of hints) {
    switch (hint) {
      case 'no rain':
        profile.precipitation_allowed = 'none';
        break;
      case 'not too sunny':
        profile.uv_index_max = 5;
        profile.cloud_cover_min = 20;
        break;
      case 'windy':
        profile.wind_speed_min = 15;
        profile.wind_speed_max = 40;
        break;
      case 'calm':
        profile.wind_speed_min = 0;
        profile.wind_speed_max = 15;
        break;
      case 'warm':
        profile.temperature_min = 22;
        break;
      case 'cool':
        profile.temperature_max = 25;
        break;
    }
  }

  return profile;
}
