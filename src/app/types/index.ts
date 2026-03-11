// PDash — Core Types

export interface Location {
  lat: number;
  lng: number;
  address: string;
  name: string;
}

export interface WeatherProfile {
  temperature_min: number; // °C
  temperature_max: number;
  wind_speed_min: number; // km/h
  wind_speed_max: number;
  precipitation_allowed: 'none' | 'light' | 'any';
  uv_index_max: number;
  cloud_cover_min: number; // %
  cloud_cover_max: number;
  daylight_required: boolean;
}

export interface TaskTemplate {
  id: string;
  activity_id: string;
  name: string;
  type: 'preparation' | 'transit' | 'activity' | 'cleanup';
  duration_estimate: number; // minutes
  lead_time: number; // minutes before activity
  depends_on: string[]; // TaskTemplate ids
  location_type: 'home' | 'en_route' | 'destination';
  notes: string;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  weather_profile: WeatherProfile;
  duration_estimate: number; // minutes
  default_destination: Location | null;
  task_templates: TaskTemplate[];
  icon: string;
}

export interface HourlyWeather {
  time: Date;
  temperature: number;
  wind_speed: number;
  wind_direction: number; // degrees, meteorological (wind coming FROM)
  precipitation: number;  // mm per hour (rain_3h / 3)
  pop: number;            // probability of precipitation 0–1 (from OWM)
  uv_index: number;
  cloud_cover: number;
  weather_code: number;
  is_day: boolean;
}

export interface OpportunityWindow {
  start: Date;
  end: Date;
  hours: HourlyWeather[];
  avg_temperature: number;
  avg_wind_speed: number;
  max_precipitation: number;
  avg_uv_index: number;
  avg_cloud_cover: number;
}

export interface ScheduledTask {
  id: string;
  plan_id: string;
  template_id: string;
  name: string;
  type: 'preparation' | 'transit' | 'activity' | 'cleanup';
  start_time: Date;
  end_time: Date;
  status: 'pending' | 'reminded' | 'in_progress' | 'done' | 'skipped';
  location: Location | null;
}

export interface ScheduledPlan {
  id: string;
  activity_id: string;
  status: 'proposed' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  weather_snapshot: OpportunityWindow;
  destination: Location;
  scheduled_tasks: ScheduledTask[];
  composite_score: number;
  score_breakdown: {
    weather: number;
    time: number;
    convenience: number;
  };
}

export interface UserPreferences {
  home_location: Location | null;
  wake_time: string; // HH:MM
  sleep_time: string;
  notification_enabled: boolean;
}

export type IntentType = 'activity_definition' | 'activity_request' | 'general_query';

export interface ParsedIntent {
  type: IntentType;
  activity_name?: string;
  weather_hints?: string[];
  task_hints?: string[];
  duration_hint?: number;
  destination_hint?: string;
  raw_text: string;
}

export interface CommuteEstimate {
  to_dest: number; // minutes
  from_dest: number;
  distance_km: number;
  mode: 'cycling' | 'walking' | 'driving';
}

export interface SpeechStatus {
  listening: boolean;
  transcript: string;
  interimTranscript: string;
  supported: boolean;
  error: string | null;
}
