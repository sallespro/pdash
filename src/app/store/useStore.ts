import { useState, useCallback, useEffect } from 'react';
import type { Activity, ScheduledPlan, UserPreferences, WeatherProfile, TaskTemplate } from '../types';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const STORAGE_KEYS = {
  activities: 'pdash_activities',
  plans: 'pdash_plans',
  prefs: 'pdash_prefs',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw, (k, v) => {
      // Revive date strings
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v);
      return v;
    });
  } catch {
    return fallback;
  }
}

function save(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data));
}

const DEFAULT_PREFS: UserPreferences = {
  home_location: null,
  wake_time: '07:00',
  sleep_time: '22:00',
  notification_enabled: true,
};

// Default weather profiles for common activities
const DEFAULT_PROFILES: Record<string, WeatherProfile> = {
  'Bike Ride': {
    temperature_min: 10, temperature_max: 35,
    wind_speed_min: 0, wind_speed_max: 30,
    precipitation_allowed: 'none',
    uv_index_max: 9, cloud_cover_min: 0, cloud_cover_max: 100,
    daylight_required: true,
  },
  'Surfing': {
    temperature_min: 16, temperature_max: 38,
    wind_speed_min: 5, wind_speed_max: 35,
    precipitation_allowed: 'light',
    uv_index_max: 11, cloud_cover_min: 0, cloud_cover_max: 100,
    daylight_required: true,
  },
  'Kite Flying': {
    temperature_min: 10, temperature_max: 35,
    wind_speed_min: 15, wind_speed_max: 50,
    precipitation_allowed: 'none',
    uv_index_max: 9, cloud_cover_min: 0, cloud_cover_max: 100,
    daylight_required: true,
  },
  'Hiking': {
    temperature_min: 8, temperature_max: 35,
    wind_speed_min: 0, wind_speed_max: 35,
    precipitation_allowed: 'none',
    uv_index_max: 9, cloud_cover_min: 0, cloud_cover_max: 100,
    daylight_required: true,
  },
  'Running': {
    temperature_min: 5, temperature_max: 35,
    wind_speed_min: 0, wind_speed_max: 30,
    precipitation_allowed: 'light',
    uv_index_max: 9, cloud_cover_min: 0, cloud_cover_max: 100,
    daylight_required: false,
  },
};

const ACTIVITY_ICONS: Record<string, string> = {
  'Bike Ride': 'bike',
  'Surfing': 'waves',
  'Kite Flying': 'wind',
  'Hiking': 'mountain',
  'Running': 'footprints',
  'Walking': 'footprints',
  'Picnic': 'utensils',
};

export function getDefaultProfile(name: string): WeatherProfile {
  return DEFAULT_PROFILES[name] || {
    temperature_min: 15, temperature_max: 30,
    wind_speed_min: 0, wind_speed_max: 25,
    precipitation_allowed: 'none',
    uv_index_max: 7, cloud_cover_min: 0, cloud_cover_max: 100,
    daylight_required: true,
  };
}

export function getActivityIcon(name: string): string {
  return ACTIVITY_ICONS[name] || 'activity';
}

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>(() => load(STORAGE_KEYS.activities, []));

  useEffect(() => { save(STORAGE_KEYS.activities, activities); }, [activities]);

  const addActivity = useCallback((activity: Omit<Activity, 'id'>) => {
    const newActivity: Activity = { ...activity, id: uid() };
    setActivities(prev => [...prev, newActivity]);
    return newActivity;
  }, []);

  const updateActivity = useCallback((id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const deleteActivity = useCallback((id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  }, []);

  const findByName = useCallback((name: string): Activity | undefined => {
    return activities.find(a => a.name.toLowerCase() === name.toLowerCase());
  }, [activities]);

  return { activities, addActivity, updateActivity, deleteActivity, findByName };
}

export function usePlans() {
  const [plans, setPlans] = useState<ScheduledPlan[]>(() => load(STORAGE_KEYS.plans, []));

  useEffect(() => { save(STORAGE_KEYS.plans, plans); }, [plans]);

  const addPlans = useCallback((newPlans: ScheduledPlan[]) => {
    setPlans(prev => [...prev, ...newPlans]);
  }, []);

  const confirmPlan = useCallback((planId: string) => {
    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, status: 'confirmed' as const } : p
    ));
  }, []);

  const dismissProposals = useCallback((activityId: string) => {
    setPlans(prev => prev.filter(p => !(p.activity_id === activityId && p.status === 'proposed')));
  }, []);

  const updateTaskStatus = useCallback((planId: string, taskId: string, status: 'done' | 'skipped' | 'in_progress') => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      return {
        ...p,
        scheduled_tasks: p.scheduled_tasks.map(t =>
          t.id === taskId ? { ...t, status } : t
        ),
      };
    }));
  }, []);

  const cancelPlan = useCallback((planId: string) => {
    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, status: 'cancelled' as const } : p
    ));
  }, []);

  const proposedPlans = plans.filter(p => p.status === 'proposed');
  const confirmedPlans = plans.filter(p => p.status === 'confirmed' || p.status === 'in_progress');

  return { plans, proposedPlans, confirmedPlans, addPlans, confirmPlan, dismissProposals, updateTaskStatus, cancelPlan };
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => load(STORAGE_KEYS.prefs, DEFAULT_PREFS));

  useEffect(() => { save(STORAGE_KEYS.prefs, prefs); }, [prefs]);

  const updatePrefs = useCallback((updates: Partial<UserPreferences>) => {
    setPrefs(prev => ({ ...prev, ...updates }));
  }, []);

  return { prefs, updatePrefs };
}

export function createTaskTemplate(
  activityId: string,
  name: string,
  type: TaskTemplate['type'],
  duration: number,
  leadTime: number = 0
): TaskTemplate {
  return {
    id: uid(),
    activity_id: activityId,
    name,
    type,
    duration_estimate: duration,
    lead_time: leadTime,
    depends_on: [],
    location_type: type === 'preparation' || type === 'cleanup' ? 'home' : 'destination',
    notes: '',
  };
}
