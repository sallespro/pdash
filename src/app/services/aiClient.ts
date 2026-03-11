/**
 * AI Client — calls the local PDash API server (/api/*)
 * Server proxied from Vite dev server → http://localhost:3001
 * The OpenAI key stays server-side (see server.js)
 */
import type { ParsedIntent, WeatherProfile } from '../types';

const BASE = '/api';
let serverAvailable: boolean | null = null;

async function checkServer(): Promise<boolean> {
  if (serverAvailable !== null) return serverAvailable;
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
  }
  return serverAvailable;
}

// Reset cached status so it re-checks on next call
export function resetServerStatus() {
  serverAvailable = null;
}

async function post<T>(path: string, body: object): Promise<T | null> {
  const ok = await checkServer();
  if (!ok) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Intent parsing ───────────────────────────────────────────────────────

export interface AIIntent {
  type: 'activity_request' | 'activity_definition' | 'general_query';
  activity_name: string | null;
  weather_hints: string[];
  task_hints: string[];
  duration_hint: number | null;
  destination_hint: string | null;
  raw_text: string;
}

export async function parseIntentAI(text: string): Promise<AIIntent | null> {
  return post<AIIntent>('/intent', { text });
}

// ─── Activity auto-configuration ─────────────────────────────────────────

export interface AIActivityConfig {
  weather_profile: WeatherProfile;
  task_templates: {
    name: string;
    type: 'preparation' | 'cleanup';
    duration_estimate: number;
    lead_time: number;
    notes: string;
  }[];
  duration_estimate: number;
  description: string;
  notes: string;
}

export async function configureActivityAI(
  description: string,
  activity_name: string
): Promise<AIActivityConfig | null> {
  return post<AIActivityConfig>('/activity-config', { description, activity_name });
}

// ─── Schedule explanation ─────────────────────────────────────────────────

export interface AIScheduleExplanation {
  explanation: string;
  highlight: string;
}

export async function explainScheduleAI(payload: {
  activity_name: string;
  weather_snapshot: any;
  score_breakdown: any;
}): Promise<AIScheduleExplanation | null> {
  return post<AIScheduleExplanation>('/explain-schedule', payload);
}

// ─── Weather window verdict ───────────────────────────────────────────────

export interface AIWindowVerdict {
  verdict: 'good' | 'ok' | 'marginal';
  reason: string;
  tips: string[];
}

export async function getWindowVerdictAI(payload: {
  activity_name: string;
  weather_profile: WeatherProfile;
  window_stats: any;
}): Promise<AIWindowVerdict | null> {
  return post<AIWindowVerdict>('/window-verdict', payload);
}
