import type { Activity } from '../types';
import { getDefaultProfile, getActivityIcon, createTaskTemplate } from './useStore';

function makeActivity(
  name: string,
  description: string,
  duration: number,
  tasks: { name: string; type: 'preparation' | 'cleanup'; duration: number; lead: number }[],
  destName?: string,
  destLat?: number,
  destLng?: number,
): Omit<Activity, 'id'> {
  const id = '__seed_' + name.replace(/\s+/g, '_').toLowerCase();
  const taskTemplates = tasks.map(t =>
    createTaskTemplate(id, t.name, t.type, t.duration, t.lead)
  );
  return {
    name,
    description,
    weather_profile: getDefaultProfile(name),
    duration_estimate: duration,
    default_destination: destLat != null ? {
      lat: destLat, lng: destLng!,
      address: destName!,
      name: destName!,
    } : null,
    task_templates: taskTemplates,
    icon: getActivityIcon(name),
  };
}

export const SEED_ACTIVITIES: Omit<Activity, 'id'>[] = [
  makeActivity(
    'Bike Ride',
    'Scenic ride along the river with a packed picnic',
    120,
    [
      { name: 'Prepare picnic', type: 'preparation', duration: 30, lead: 90 },
      { name: 'Check tire pressure', type: 'preparation', duration: 10, lead: 60 },
      { name: 'Fill water bottles', type: 'preparation', duration: 5, lead: 50 },
      { name: 'Clean bike', type: 'cleanup', duration: 15, lead: 0 },
    ],
  ),

  makeActivity(
    'Surfing',
    'Morning surf session — needs offshore wind and clean waves',
    90,
    [
      { name: 'Get wetsuit ready', type: 'preparation', duration: 10, lead: 60 },
      { name: 'Wax board', type: 'preparation', duration: 10, lead: 50 },
      { name: 'Apply sunscreen', type: 'preparation', duration: 5, lead: 30 },
      { name: 'Rinse board and wetsuit', type: 'cleanup', duration: 15, lead: 0 },
    ],
  ),

  makeActivity(
    'Kite Flying',
    'Fly the kite in the park — needs steady breeze',
    60,
    [
      { name: 'Pack kite and string', type: 'preparation', duration: 10, lead: 30 },
      { name: 'Check wind forecast', type: 'preparation', duration: 5, lead: 60 },
    ],
  ),

  makeActivity(
    'Hiking',
    'Half-day trail hike in the hills',
    180,
    [
      { name: 'Pack trail snacks', type: 'preparation', duration: 15, lead: 90 },
      { name: 'Prepare hiking gear', type: 'preparation', duration: 20, lead: 120 },
      { name: 'Check route/map', type: 'preparation', duration: 10, lead: 60 },
      { name: 'Repack gear', type: 'cleanup', duration: 10, lead: 0 },
    ],
  ),

  makeActivity(
    'Running',
    'Easy morning jog — no special prep needed',
    45,
    [
      { name: 'Stretch', type: 'preparation', duration: 5, lead: 15 },
    ],
  ),
];

const SEED_VERSION = 2; // bump to force re-seed with updated profiles

export function isSeedNeeded(): boolean {
  const storedVersion = Number(localStorage.getItem('pdash_seed_version') || '0');
  if (storedVersion < SEED_VERSION) {
    // Clear stale activities so seed runs fresh with updated profiles
    localStorage.removeItem('pdash_activities');
    localStorage.setItem('pdash_seed_version', String(SEED_VERSION));
    return true;
  }
  return localStorage.getItem('pdash_activities') === null ||
    JSON.parse(localStorage.getItem('pdash_activities') || '[]').length === 0;
}
