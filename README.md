# PDash — Personal Outdoor Activity Dashboard

PDash is a weather-aware outdoor activity scheduling assistant that combines voice input, natural language processing, real-time weather data, and route planning to intelligently recommend when to schedule your outdoor activities.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Frontend](#frontend)
- [API Reference](#api-reference)
- [Services & Business Logic](#services--business-logic)
- [Data Model](#data-model)
- [State Management](#state-management)
- [External Integrations](#external-integrations)
- [Environment Variables](#environment-variables)
- [Security Notes](#security-notes)

---

## Overview

PDash lets you describe an outdoor activity in plain language (by voice or text). It parses your intent using AI, checks the 3-day weather forecast, calculates commute times, and proposes up to **3 optimally-timed schedule windows** — complete with a full task timeline covering preparation, transit, the activity itself, and cleanup.

All data is stored locally in the browser (localStorage). There is no backend database.

---

## Features

- **Voice Input** — speak your activity request using the browser's Web Speech API
- **AI Intent Parsing** — extract activity name, weather hints, and task hints from natural language
- **Weather Forecasting** — 72-hour hourly weather data from Open-Meteo (free, no key required)
- **Smart Scheduling** — composite scoring (weather match + time-of-day + window duration) surfaces the best windows
- **Full Task Timelines** — preparation, transit to/from destination, activity, and cleanup tasks automatically generated
- **Activity Library** — create, edit, and manage reusable activity profiles with weather requirements and task templates
- **AI Activity Config** — auto-fill weather profiles and task templates for any activity using OpenAI
- **Schedule Explanations** — AI-generated plain-language summaries of why each time window is recommended
- **Geolocation** — uses browser geolocation + OpenStreetMap reverse geocoding for home location
- **Browser Notifications** — 15-minute reminders before each scheduled task
- **Persistent Storage** — all activities, plans, and preferences survive page reloads via localStorage
- **Responsive UI** — Tailwind CSS + Radix UI component library with dark mode support

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | — | Type safety |
| Vite | 6.3.5 | Build tool & dev server |
| Tailwind CSS | v4 | Utility-first styling |
| Radix UI | various | Headless accessible components |
| shadcn/ui | — | Styled Radix component layer |
| Lucide React | — | Icon library |
| React Router | v7.13 | Client-side routing |
| React Hook Form | — | Form state management |
| Recharts | — | Data visualization |
| Motion | — | Animations |
| Sonner | — | Toast notifications |
| date-fns | — | Date utilities |

### Backend

| Technology | Version | Role |
|---|---|---|
| Node.js | — | Runtime |
| Express | 5.2.1 | HTTP server |
| OpenAI SDK | — | GPT-4.1-mini integration |

### External APIs

| API | Auth | Purpose |
|---|---|---|
| Open-Meteo | None (free) | Hourly weather forecasts |
| OpenStreetMap Nominatim | None (free) | Geocoding & reverse geocoding |
| OpenAI | API key (server-side) | Intent parsing, activity config, explanations |

---

## Architecture

```
Browser (React SPA)
  │
  ├── Web Speech API          ← voice input
  ├── Geolocation API         ← user location
  ├── Notifications API       ← task reminders
  ├── localStorage            ← all persistent data
  │
  └── HTTP (via Vite proxy /api/*)
        │
        └── Express API Server (port 3099)
              │
              └── OpenAI (gpt-4.1-mini)   ← AI features
                    (key never exposed to browser)

Weather & Geocoding calls are made directly from the browser
(Open-Meteo and Nominatim require no API keys)
```

### Key Architectural Decisions

- **No database** — localStorage-only, client-first. Zero infrastructure beyond the Express server.
- **Single-page state machine** — All screens managed via `App.tsx` switch statement, not URL routes.
- **Hybrid intent parsing** — Fast regex/pattern matching first, AI fallback only when needed. Degrades gracefully if the API server is unavailable.
- **Server-side AI** — All OpenAI calls go through the Express server to keep the API key out of the browser bundle.
- **1-hour weather cache** — Forecasts are cached by coordinates to avoid redundant API calls.

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- An OpenAI API key

### Installation

```bash
git clone <repo-url>
cd pdash
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
API_PORT=3099          # optional, defaults to 3099
```

### Running

```bash
# Start both frontend and backend together
npm run dev:full

# Or start separately:
npm run dev      # Vite dev server (port 5173)
npm run server   # Express API server (port 3099)
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:3099`.

### Production Build

```bash
npm run build    # outputs to dist/
```

Serve the `dist/` folder as static files alongside the running Express server.

---

## Frontend

### Screens

The app uses a state-driven screen system (not URL routing). The six screens are:

| Screen | Component | Description |
|---|---|---|
| Dashboard | `Dashboard.tsx` | Current weather, upcoming plans, 3-day forecast |
| Activities | `ActivityLibrary.tsx` | Browse, create, edit, delete activity profiles |
| Activity Editor | `ActivityEditor.tsx` | Full form for activity config + AI auto-fill |
| Schedule Proposals | `ScheduleProposals.tsx` | 3 ranked time windows with weather details and AI explanations |
| Active Schedule | `ActiveSchedule.tsx` | Task timeline with progress tracking (done / skipped) |
| Settings | `Settings.tsx` | Home location, wake/sleep times, notification preferences |

### Navigation

Bottom navigation bar with icons for Home, Activities, and Settings. Proposals and Active Schedule screens are reached contextually (by requesting or confirming a plan).

### Voice Overlay

The `VoiceOverlay` component wraps the browser Web Speech API and provides:
- Live transcription with interim results shown in real time
- Confirmation step before parsing the final transcript
- Fallback text input for unsupported browsers

### Activity Editor AI Auto-Fill

When creating or editing an activity, users can trigger AI auto-fill. The frontend posts to `POST /api/activity-config` with the activity name and description. The server returns a complete weather profile, task template list, and duration estimate, pre-populating the form.

### UI Component Library

40+ components under `src/app/components/ui/`, all built on Radix UI primitives:

`accordion`, `alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `card`, `carousel`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`, `tooltip`

---

## API Reference

Base URL: `http://localhost:3099` (configurable via `API_PORT`)

All request and response bodies are JSON. All endpoints except `/api/health` use `POST`.

---

### `GET /api/health`

Health check endpoint.

**Response**
```json
{
  "status": "ok",
  "model": "gpt-4.1-mini",
  "openai": true,
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

---

### `POST /api/intent`

Parse a natural language activity request into a structured intent object.

**Request**
```json
{
  "text": "I want to go for a bike ride tomorrow morning when the wind is calm"
}
```

**Response**
```json
{
  "activity_name": "Bike Ride",
  "weather_hints": {
    "wind_speed_max": 15,
    "precipitation_allowed": false
  },
  "task_hints": [],
  "duration_estimate": 90,
  "destination_hint": null,
  "confidence": 0.92
}
```

| Field | Type | Description |
|---|---|---|
| `activity_name` | string | Normalized activity name |
| `weather_hints` | object | Partial weather profile overrides from the user's request |
| `task_hints` | array | Task-related instructions mentioned by the user |
| `duration_estimate` | number \| null | Duration in minutes, or null if not specified |
| `destination_hint` | string \| null | Destination name if mentioned |
| `confidence` | number | 0–1 parse confidence score |

---

### `POST /api/activity-config`

Generate a complete activity configuration (weather profile + task templates + duration) from a name and description. Used by the Activity Editor AI auto-fill feature.

**Request**
```json
{
  "activity_name": "Surfing",
  "description": "Ocean surfing at a local beach"
}
```

**Response**
```json
{
  "weather_profile": {
    "temperature_min": 15,
    "temperature_max": 32,
    "wind_speed_min": 5,
    "wind_speed_max": 25,
    "precipitation_allowed": false,
    "uv_index_max": 9,
    "cloud_cover_min": 0,
    "cloud_cover_max": 60,
    "daylight_required": true
  },
  "task_templates": [
    {
      "name": "Wax surfboard",
      "type": "preparation",
      "duration_estimate": 10,
      "lead_time": 60
    },
    {
      "name": "Drive to beach",
      "type": "transit",
      "duration_estimate": 20,
      "lead_time": 0
    }
  ],
  "duration_estimate": 120
}
```

---

### `POST /api/explain-schedule`

Generate a plain-language explanation of why a proposed time slot is a good choice for the activity.

**Request**
```json
{
  "activity_name": "Bike Ride",
  "weather_snapshot": {
    "temperature": 22,
    "wind_speed": 10,
    "precipitation": 0,
    "uv_index": 4,
    "cloud_cover": 20
  },
  "score_breakdown": {
    "weather_score": 0.88,
    "time_score": 0.75,
    "convenience_score": 0.90,
    "composite_score": 0.85
  }
}
```

**Response**
```json
{
  "explanation": "Saturday morning looks ideal for your bike ride. Temperatures will be a comfortable 22°C with a light 10 km/h breeze — perfect cycling conditions. Clear skies and low UV make for a pleasant ride.",
  "highlight": "Perfect weather window"
}
```

---

### `POST /api/window-verdict`

Evaluate whether a weather window is a good, acceptable, or poor match for an activity's weather profile.

**Request**
```json
{
  "activity_name": "Kite Flying",
  "weather_profile": {
    "wind_speed_min": 15,
    "wind_speed_max": 40,
    "precipitation_allowed": false
  },
  "window_stats": {
    "avg_wind_speed": 12,
    "max_precipitation": 0,
    "avg_temperature": 18
  }
}
```

**Response**
```json
{
  "verdict": "marginal",
  "reason": "Wind speeds are slightly below ideal for kite flying. You may struggle to get good lift.",
  "tips": [
    "Try an open hilltop location to catch stronger winds",
    "A lighter sport kite may work better in these conditions"
  ]
}
```

| `verdict` | Meaning |
|---|---|
| `"good"` | Conditions well within the activity's weather profile |
| `"marginal"` | Conditions borderline — activity is possible but not ideal |
| `"poor"` | Conditions outside the acceptable weather profile |

---

## Services & Business Logic

All services live under `src/app/services/`.

### `intentParser.ts`

Two-stage natural language parsing:

1. **Pattern matching** — regex + activity synonym dictionary maps common phrases to standard activity names (e.g., `"ride my bike"` → `"Bike Ride"`, `"catch some waves"` → `"Surfing"`)
2. **AI fallback** — if pattern matching produces low confidence, calls `POST /api/intent`

### `weather.ts`

- Fetches 72-hour hourly forecasts from Open-Meteo for a given lat/lng
- Caches results for 1 hour per coordinate pair
- Identifies **opportunity windows**: contiguous time blocks where all weather parameters match the activity's weather profile
- Scores windows with a composite formula:
  - **50%** weather match quality
  - **30%** time-of-day preference (peaks at 9–11 am and 3–5 pm)
  - **20%** window duration (longer is better, up to a ceiling)

### `scheduleComposer.ts`

Takes a scored opportunity window and builds a complete schedule:

1. Anchors the activity inside the weather window
2. Back-fills preparation tasks (respects `lead_time` and user's `wake_time`)
3. Inserts outbound transit task before the activity
4. Inserts inbound transit task after the activity
5. Appends cleanup tasks (respects user's `sleep_time`)
6. Returns the top 3 schedules, preferring different days

### `routing.ts`

- Haversine formula for straight-line distance between coordinates
- Geocoding via OpenStreetMap Nominatim (address string → lat/lng)
- Reverse geocoding (lat/lng → human-readable address)
- Commute time estimation by travel mode:
  - Cycling: 18 km/h
  - Walking: 5 km/h
  - Driving: 40 km/h
  - All estimates include a **30% buffer** over straight-line distance

### `speechToText.ts`

Wraps the browser's `SpeechRecognition` API:
- Continuous listening with interim results streamed in real time
- Final transcript returned on silence or manual stop
- Language: `en-US` (configurable)
- Graceful fallback messaging for unsupported browsers

### `aiClient.ts`

Thin HTTP client for the Express API:
- `POST` helper with 12-second timeout
- Health check for server availability detection
- Typed interfaces for all request/response payloads

---

## Data Model

All types are defined in `src/app/types/index.ts`.

### `Activity`

```typescript
interface Activity {
  id: string
  name: string
  description: string
  icon: string
  duration_estimate: number          // minutes
  default_destination?: Location
  weather_profile: WeatherProfile
  task_templates: TaskTemplate[]
}
```

### `WeatherProfile`

```typescript
interface WeatherProfile {
  temperature_min: number            // °C
  temperature_max: number            // °C
  wind_speed_min: number             // km/h
  wind_speed_max: number             // km/h
  precipitation_allowed: boolean
  uv_index_max: number
  cloud_cover_min: number            // %
  cloud_cover_max: number            // %
  daylight_required: boolean
}
```

### `TaskTemplate`

```typescript
interface TaskTemplate {
  id: string
  activity_id: string
  name: string
  type: 'preparation' | 'transit' | 'activity' | 'cleanup'
  duration_estimate: number          // minutes
  lead_time: number                  // minutes before activity start
  depends_on: string[]               // other template IDs
  location_type: 'home' | 'destination' | 'transit'
  notes?: string
}
```

### `ScheduledPlan`

```typescript
interface ScheduledPlan {
  id: string
  activity_id: string
  status: 'proposed' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  weather_snapshot: WeatherSnapshot
  destination: Location
  scheduled_tasks: ScheduledTask[]
  composite_score: number
  score_breakdown: ScoreBreakdown
}
```

### `ScheduledTask`

```typescript
interface ScheduledTask {
  id: string
  plan_id: string
  template_id: string
  name: string
  type: 'preparation' | 'transit' | 'activity' | 'cleanup'
  start_time: Date
  end_time: Date
  status: 'pending' | 'reminded' | 'in_progress' | 'done' | 'skipped'
  location?: Location
}
```

### `UserPreferences`

```typescript
interface UserPreferences {
  home_location: Location | null
  wake_time: string                  // "HH:MM"
  sleep_time: string                 // "HH:MM"
  notification_enabled: boolean
}
```

---

## State Management

State is managed via custom React hooks backed by `localStorage`. No external state library is used.

| Hook | Storage Key | Contents |
|---|---|---|
| `useActivities()` | `pdash_activities` | User's activity library |
| `usePlans()` | `pdash_plans` | Proposed and confirmed schedules |
| `usePreferences()` | `pdash_prefs` | User settings |

Each hook exposes CRUD operations that auto-persist to localStorage on every mutation. `Date` objects are serialized to ISO strings and reconstructed via a custom JSON reviver on read.

**Default seed data** is inserted on first run:
- Activities: Bike Ride, Surfing, Kite Flying, Hiking, Running (each with sensible weather profiles and task templates)
- Preferences: `wake_time: "07:00"`, `sleep_time: "22:00"`, `notification_enabled: true`

---

## External Integrations

### Open-Meteo (Weather)

- **URL**: `https://api.open-meteo.com/v1/forecast`
- **Auth**: None
- **Hourly variables fetched**: `temperature_2m`, `windspeed_10m`, `precipitation`, `uv_index`, `cloudcover`, `is_day`
- **Forecast range**: 3 days
- **Called from**: Browser (frontend service)

### OpenStreetMap Nominatim (Geocoding)

- **Geocoding URL**: `https://nominatim.openstreetmap.org/search`
- **Reverse geocoding URL**: `https://nominatim.openstreetmap.org/reverse`
- **Auth**: None (free; include a descriptive `User-Agent` header per Nominatim usage policy)
- **Called from**: Browser (frontend service)

### OpenAI

- **Model**: `gpt-4.1-mini`
- **Auth**: `OPENAI_API_KEY` environment variable (server-side only, never sent to the browser)
- **Called from**: Express server only
- **Used for**: Intent parsing, activity auto-configuration, schedule explanations, weather window verdicts

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key for all AI features |
| `API_PORT` | No | Express server port (default: `3099`) |

Variables prefixed with `VITE_` are bundled into the browser at build time. Do **not** prefix sensitive keys with `VITE_`.

---

## Security Notes

- **OpenAI API key** is loaded server-side only and never included in the browser bundle
- **No user authentication** — this is a single-user personal tool; all data is scoped to the local browser
- **localStorage is not encrypted** — avoid storing sensitive personal data beyond location preferences
- **Add `.env` to `.gitignore`** — never commit API keys to version control
- **Nominatim usage policy** — include a descriptive `User-Agent` header in geocoding requests in production
