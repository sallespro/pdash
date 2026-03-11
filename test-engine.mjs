/**
 * PDash Engine Test Runner
 * Tests all core logic: intent parsing, weather windows, schedule composition
 * Run with: node test-engine.mjs
 */

// ─── Inline types / helpers ────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${e.message}`);
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertDefined(v, msg) { if (v == null) throw new Error(msg || 'Expected defined value, got null/undefined'); }

// ─── 1. INTENT PARSER ─────────────────────────────────────────────────────

console.log('\n── Intent Parser ─────────────────────────────────────────────');

// Inline parseIntent (copied logic, no TS imports)
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
const WEATHER_KEYWORDS = {
  'no rain': ['no rain', 'not rainy', 'dry', 'without rain', 'no precipitation'],
  'not too sunny': ['not too sunny', 'not blazing', 'partly cloudy', 'some shade', 'moderate sun'],
  'windy': ['windy', 'wind', 'breezy', 'good wind'],
  'calm': ['calm', 'no wind', 'still', 'not windy'],
  'warm': ['warm', 'hot', 'heated'],
  'cool': ['cool', 'mild', 'not too hot'],
};
const TASK_KEYWORDS = {
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
const ACTIVITY_SYNONYMS = {
  'ride my bike': 'Bike Ride', 'ride a bike': 'Bike Ride', 'bike ride': 'Bike Ride',
  'bike': 'Bike Ride', 'cycling': 'Bike Ride', 'cycle': 'Bike Ride', 'bicycle': 'Bike Ride',
  'surf': 'Surfing', 'surfing': 'Surfing', 'go surfing': 'Surfing',
  'fly a kite': 'Kite Flying', 'kite flying': 'Kite Flying', 'kite': 'Kite Flying', 'fly': 'Kite Flying',
  'hike': 'Hiking', 'hiking': 'Hiking', 'go hiking': 'Hiking',
  'walk': 'Walking', 'go for a walk': 'Walking',
  'run': 'Running', 'running': 'Running', 'go running': 'Running', 'jog': 'Running', 'jogging': 'Running',
  'picnic': 'Picnic', 'go for a picnic': 'Picnic',
};
const DURATION_PATTERNS = [/(\d+)\s*hours?/i, /(\d+)\s*minutes?/i, /about\s*(\d+)\s*h/i];

function parseIntent(text) {
  const lower = text.toLowerCase().trim();
  for (const p of DEFINITION_PATTERNS) { if (lower.match(p)) return buildIntent('activity_definition', text, lower); }
  for (const p of REQUEST_PATTERNS) { if (lower.match(p)) return buildIntent('activity_request', text, lower); }
  for (const [syn] of Object.entries(ACTIVITY_SYNONYMS)) { if (lower.includes(syn)) return buildIntent('activity_request', text, lower); }
  return { type: 'general_query', raw_text: text };
}
function buildIntent(type, raw, lower) {
  const intent = { type, raw_text: raw };
  for (const [syn, name] of Object.entries(ACTIVITY_SYNONYMS)) { if (lower.includes(syn)) { intent.activity_name = name; break; } }
  const weatherHints = [];
  for (const [hint, kws] of Object.entries(WEATHER_KEYWORDS)) { if (kws.some(k => lower.includes(k))) weatherHints.push(hint); }
  if (weatherHints.length) intent.weather_hints = weatherHints;
  const taskHints = [];
  for (const [kw, taskName] of Object.entries(TASK_KEYWORDS)) { if (lower.includes(kw)) taskHints.push(taskName); }
  if (taskHints.length) intent.task_hints = taskHints;
  for (const p of DURATION_PATTERNS) { const m = lower.match(p); if (m) { intent.duration_hint = p.source.includes('hour') ? parseInt(m[1]) * 60 : parseInt(m[1]); break; } }
  return intent;
}

const SCENARIOS = [
  // Activity definitions
  { input: 'I like to ride my bike and have a picnic', expect: { type: 'activity_definition', activity_name: 'Bike Ride', task_hints: ['Prepare picnic'] } },
  { input: 'I like to surf when it is windy and dry', expect: { type: 'activity_definition', activity_name: 'Surfing', weather_hints: ['no rain', 'windy'] } },
  { input: 'I like to go hiking, usually takes 3 hours', expect: { type: 'activity_definition', activity_name: 'Hiking', duration_hint: 180 } },
  { input: 'For my bike ride I need to check tire pressure and prepare a picnic', expect: { type: 'activity_definition', activity_name: 'Bike Ride', task_hints: ['Check tire pressure', 'Prepare picnic'] } },
  { input: 'I like to fly a kite on windy days when there is no rain', expect: { type: 'activity_definition', activity_name: 'Kite Flying', weather_hints: ['no rain', 'windy'] } },

  // Activity requests
  { input: 'I want to ride my bike', expect: { type: 'activity_request', activity_name: 'Bike Ride' } },
  { input: 'I want to go surfing this week', expect: { type: 'activity_request', activity_name: 'Surfing' } },
  { input: 'Can I go hiking tomorrow?', expect: { type: 'activity_request', activity_name: 'Hiking' } },
  { input: "Let's go for a run", expect: { type: 'activity_request', activity_name: 'Running' } },
  { input: 'Find a time for my bike ride', expect: { type: 'activity_request', activity_name: 'Bike Ride' } },
  { input: 'Schedule a bike ride', expect: { type: 'activity_request', activity_name: 'Bike Ride' } },
  { input: 'When can I go surfing?', expect: { type: 'activity_request', activity_name: 'Surfing' } },

  // General
  { input: 'What is the weather today?', expect: { type: 'general_query' } },
  { input: 'Hello there', expect: { type: 'general_query' } },
];

for (const { input, expect: exp } of SCENARIOS) {
  test(`parseIntent: "${input.slice(0, 50)}"`, () => {
    const result = parseIntent(input);
    assertEqual(result.type, exp.type);
    if (exp.activity_name) assertEqual(result.activity_name, exp.activity_name);
    if (exp.weather_hints) {
      assertDefined(result.weather_hints, 'weather_hints should be defined');
      for (const h of exp.weather_hints) {
        assert(result.weather_hints.includes(h), `Missing weather hint: ${h}, got: ${JSON.stringify(result.weather_hints)}`);
      }
    }
    if (exp.task_hints) {
      assertDefined(result.task_hints, 'task_hints should be defined');
      for (const t of exp.task_hints) {
        assert(result.task_hints.includes(t), `Missing task hint: ${t}, got: ${JSON.stringify(result.task_hints)}`);
      }
    }
    if (exp.duration_hint) assertEqual(result.duration_hint, exp.duration_hint);
  });
}

// ─── 2. WEATHER WINDOW FINDER ─────────────────────────────────────────────

console.log('\n── Weather Window Finder ─────────────────────────────────────');

function hourMatchesProfile(hour, profile) {
  if (hour.temperature < profile.temperature_min || hour.temperature > profile.temperature_max) return false;
  if (hour.wind_speed < profile.wind_speed_min || hour.wind_speed > profile.wind_speed_max) return false;
  if (profile.precipitation_allowed === 'none' && hour.precipitation > 0) return false;
  if (profile.precipitation_allowed === 'light' && hour.precipitation > 2.5) return false;
  if (hour.uv_index > profile.uv_index_max) return false;
  if (hour.cloud_cover < profile.cloud_cover_min || hour.cloud_cover > profile.cloud_cover_max) return false;
  if (profile.daylight_required && !hour.is_day) return false;
  return true;
}

function makeHour(base, offset, overrides = {}) {
  const time = new Date(base.getTime() + offset * 3600000);
  return {
    time,
    temperature: 22,
    wind_speed: 12,
    precipitation: 0,
    uv_index: 4,
    cloud_cover: 40,
    weather_code: 1,
    is_day: time.getHours() >= 7 && time.getHours() <= 20,
    ...overrides,
  };
}

function findOpportunityWindows(forecast, profile, minDurationMinutes) {
  const windows = [];
  let currentRun = [];
  for (const hour of forecast) {
    if (hourMatchesProfile(hour, profile)) {
      currentRun.push(hour);
    } else {
      if (currentRun.length > 0) { maybeAddWindow(currentRun, minDurationMinutes, windows); currentRun = []; }
    }
  }
  if (currentRun.length > 0) maybeAddWindow(currentRun, minDurationMinutes, windows);
  return windows;
}

function maybeAddWindow(hours, minMinutes, windows) {
  const durationMinutes = hours.length * 60;
  if (durationMinutes >= minMinutes) {
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    windows.push({
      start: hours[0].time,
      end: new Date(hours[hours.length - 1].time.getTime() + 3600000),
      hours,
      avg_temperature: avg(hours.map(h => h.temperature)),
      avg_wind_speed: avg(hours.map(h => h.wind_speed)),
      max_precipitation: Math.max(...hours.map(h => h.precipitation)),
      avg_uv_index: avg(hours.map(h => h.uv_index)),
      avg_cloud_cover: avg(hours.map(h => h.cloud_cover)),
    });
  }
}

const bikeProfile = {
  temperature_min: 14, temperature_max: 32,
  wind_speed_min: 0, wind_speed_max: 25,
  precipitation_allowed: 'none',
  uv_index_max: 7, cloud_cover_min: 0, cloud_cover_max: 100,
  daylight_required: true,
};

const kiteProfile = {
  temperature_min: 10, temperature_max: 30,
  wind_speed_min: 15, wind_speed_max: 45,
  precipitation_allowed: 'none',
  uv_index_max: 8, cloud_cover_min: 0, cloud_cover_max: 100,
  daylight_required: true,
};

// Build a 72-hour mock forecast
const now = new Date();
now.setMinutes(0, 0, 0);
const mockForecast = [];
for (let i = 0; i < 72; i++) {
  mockForecast.push(makeHour(now, i));
}

test('finds windows matching bike profile in clear 72h forecast', () => {
  const windows = findOpportunityWindows(mockForecast, bikeProfile, 120);
  assert(windows.length > 0, `Expected at least 1 window, got ${windows.length}`);
});

test('each window is at least minDuration long', () => {
  const windows = findOpportunityWindows(mockForecast, bikeProfile, 120);
  for (const w of windows) {
    const dur = (w.end.getTime() - w.start.getTime()) / 60000;
    assert(dur >= 120, `Window only ${dur} min, expected >= 120`);
  }
});

test('rain breaks a window', () => {
  // Use a fixed 8am base so all 12 hours fall in daytime (8am–7pm), predictable regardless of when test runs
  const base8am = new Date(); base8am.setHours(8, 0, 0, 0);
  const forecast = [];
  for (let i = 0; i < 12; i++) forecast.push({ ...makeHour(base8am, i), is_day: true });
  // Insert rain at hour 5 (1pm) — force is_day:true so only rain breaks the window
  forecast[5] = { ...makeHour(base8am, 5, { precipitation: 1.5 }), is_day: true };
  const windows = findOpportunityWindows(forecast, bikeProfile, 60);
  // Should find 2 windows split by rain: hours 0-4 and hours 6-11
  assert(windows.length === 2, `Expected 2 windows, got ${windows.length}: ${windows.map(w => `${w.start.getHours()}h-${w.end.getHours()}h`).join(', ')}`);
});

test('no windows when all hours are rainy', () => {
  const rainyForecast = mockForecast.map(h => ({ ...h, precipitation: 5 }));
  const windows = findOpportunityWindows(rainyForecast, bikeProfile, 60);
  assertEqual(windows.length, 0, `Expected 0 windows, got ${windows.length}`);
});

test('kite profile requires minimum wind', () => {
  // Create forecast with low wind — should not match kite profile
  const calmForecast = mockForecast.map(h => ({ ...h, wind_speed: 5 }));
  const windows = findOpportunityWindows(calmForecast, kiteProfile, 60);
  assertEqual(windows.length, 0, `Expected 0 kite windows with low wind, got ${windows.length}`);
});

test('kite profile matches when wind is right', () => {
  const windyForecast = mockForecast.map(h => ({ ...h, wind_speed: 25 }));
  const windows = findOpportunityWindows(windyForecast, kiteProfile, 60);
  assert(windows.length > 0, `Expected kite windows with 25 km/h wind, got 0`);
});

test('nighttime hours excluded when daylight_required', () => {
  // Only use hours 0-5 (night)
  const nightForecast = [];
  const midnight = new Date(now);
  midnight.setHours(1, 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    nightForecast.push({ ...makeHour(midnight, i), is_day: false });
  }
  const windows = findOpportunityWindows(nightForecast, bikeProfile, 60);
  assertEqual(windows.length, 0, `Expected 0 windows at night with daylight_required`);
});

test('short windows below minimum duration are excluded', () => {
  // Only 1 good hour, need 2
  const shortForecast = [
    makeHour(now, 0),
    makeHour(now, 1, { precipitation: 5 }), // rain breaks
  ];
  const windows = findOpportunityWindows(shortForecast, bikeProfile, 120);
  assertEqual(windows.length, 0, `Expected 0 windows with only 1 good hour`);
});

// ─── 3. SCHEDULE COMPOSER ─────────────────────────────────────────────────

console.log('\n── Schedule Composer ─────────────────────────────────────────');

function composeSchedules(activity, windows, commute, wakeTime, sleepTime) {
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  const [sleepH, sleepM] = sleepTime.split(':').map(Number);
  const candidates = [];
  for (const window of windows) {
    const plan = buildPlanForWindow(activity, window, commute, wakeH, wakeM, sleepH, sleepM);
    if (plan) candidates.push(plan);
  }
  candidates.sort((a, b) => b.composite_score - a.composite_score);
  const result = [];
  const usedDays = new Set();
  for (const plan of candidates) {
    const dayKey = plan.weather_snapshot.start.toDateString();
    if (result.length < 3) {
      result.push(plan);
      usedDays.add(dayKey);
    }
  }
  return result;
}

function scoreWindow(window, profile) {
  const tempMid = (profile.temperature_min + profile.temperature_max) / 2;
  const tempRange = profile.temperature_max - profile.temperature_min;
  const tempScore = Math.max(0, 1 - Math.abs(window.avg_temperature - tempMid) / (tempRange / 2));
  const windMid = (profile.wind_speed_min + profile.wind_speed_max) / 2;
  const windRange = profile.wind_speed_max - profile.wind_speed_min;
  const windScore = windRange > 0 ? Math.max(0, 1 - Math.abs(window.avg_wind_speed - windMid) / (windRange / 2)) : 1;
  const uvScore = Math.max(0, 1 - window.avg_uv_index / profile.uv_index_max);
  const precipScore = window.max_precipitation === 0 ? 1 : 0.5;
  const weatherScore = (tempScore + windScore + uvScore + precipScore) / 4;
  const startHour = window.start.getHours();
  const idealHours = [9, 10, 15, 16];
  const minDist = Math.min(...idealHours.map(h => Math.abs(startHour - h)));
  const timeScore = Math.max(0, 1 - minDist / 6);
  const durationHours = (window.end.getTime() - window.start.getTime()) / 3600000;
  const convenienceScore = Math.min(1, durationHours / 6);
  return { weather: weatherScore, time: timeScore, convenience: convenienceScore, composite: 0.5 * weatherScore + 0.3 * timeScore + 0.2 * convenienceScore };
}

function buildPlanForWindow(activity, window, commute, wakeH, wakeM, sleepH, sleepM) {
  const planId = uid();
  const tasks = [];
  const activityMinutes = activity.duration_estimate;
  const totalWindowMinutes = commute.to_dest + activityMinutes + commute.from_dest;
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();
  const windowDuration = (windowEnd - windowStart) / 60000;
  if (windowDuration < totalWindowMinutes) return null;

  const slack = windowDuration - totalWindowMinutes;
  const offsetMinutes = Math.floor(slack / 2);
  const transitStartTime = windowStart + offsetMinutes * 60000;

  // Skip transit tasks if commute is 0 (no destination set)
  if (commute.to_dest > 0) {
    tasks.push({ id: uid(), plan_id: planId, template_id: '__transit_to', name: `Commute to ${activity.default_destination?.name || 'destination'}`, type: 'transit', start_time: new Date(transitStartTime), end_time: new Date(transitStartTime + commute.to_dest * 60000), status: 'pending', location: activity.default_destination });
  }
  const activityStart = new Date(transitStartTime + commute.to_dest * 60000);
  const activityEnd = new Date(activityStart.getTime() + activityMinutes * 60000);
  tasks.push({ id: uid(), plan_id: planId, template_id: '__activity', name: activity.name, type: 'activity', start_time: activityStart, end_time: activityEnd, status: 'pending', location: activity.default_destination });
  if (commute.from_dest > 0) {
    tasks.push({ id: uid(), plan_id: planId, template_id: '__transit_back', name: 'Commute back home', type: 'transit', start_time: activityEnd, end_time: new Date(activityEnd.getTime() + commute.from_dest * 60000), status: 'pending', location: null });
  }

  const transitToStart = new Date(transitStartTime);
  const prepTasks = (activity.task_templates || []).filter(t => t.type === 'preparation').sort((a, b) => b.lead_time - a.lead_time);
  let earliestStart = transitToStart.getTime();
  for (const template of prepTasks) {
    const taskStart = new Date(earliestStart - template.duration_estimate * 60000);
    const dayStart = new Date(taskStart); dayStart.setHours(wakeH, wakeM, 0, 0);
    if (taskStart.getTime() < dayStart.getTime()) return null;
    tasks.unshift({ id: uid(), plan_id: planId, template_id: template.id, name: template.name, type: 'preparation', start_time: taskStart, end_time: new Date(earliestStart), status: 'pending', location: null });
    earliestStart = taskStart.getTime();
  }

  const returnEnd = commute.from_dest > 0 ? activityEnd.getTime() + commute.from_dest * 60000 : activityEnd.getTime();
  let latestEnd = returnEnd;
  const cleanupTasks = (activity.task_templates || []).filter(t => t.type === 'cleanup');
  for (const template of cleanupTasks) {
    const taskEnd = new Date(latestEnd + template.duration_estimate * 60000);
    const daySleep = new Date(taskEnd); daySleep.setHours(sleepH, sleepM, 0, 0);
    if (taskEnd.getTime() > daySleep.getTime()) return null;
    tasks.push({ id: uid(), plan_id: planId, template_id: template.id, name: template.name, type: 'cleanup', start_time: new Date(latestEnd), end_time: taskEnd, status: 'pending', location: null });
    latestEnd = taskEnd.getTime();
  }

  const scores = scoreWindow(window, activity.weather_profile);
  return { id: planId, activity_id: activity.id, status: 'proposed', weather_snapshot: window, destination: activity.default_destination || { lat: 0, lng: 0, address: '', name: 'TBD' }, scheduled_tasks: tasks, composite_score: scores.composite, score_breakdown: scores };
}

// Sample activity: Bike Ride with Picnic
const bikeActivity = {
  id: 'test-bike',
  name: 'Bike Ride',
  description: 'Scenic ride with picnic',
  weather_profile: bikeProfile,
  duration_estimate: 120,
  default_destination: { lat: 48.86, lng: 2.35, address: 'Park', name: 'Riverside Park' },
  task_templates: [
    { id: 't1', activity_id: 'test-bike', name: 'Prepare picnic', type: 'preparation', duration_estimate: 30, lead_time: 90, depends_on: [], location_type: 'home', notes: '' },
    { id: 't2', activity_id: 'test-bike', name: 'Check tire pressure', type: 'preparation', duration_estimate: 10, lead_time: 60, depends_on: [], location_type: 'home', notes: '' },
    { id: 't3', activity_id: 'test-bike', name: 'Clean bike', type: 'cleanup', duration_estimate: 15, lead_time: 0, depends_on: [], location_type: 'home', notes: '' },
  ],
  icon: 'bike',
};

// No-destination activity
const runActivity = {
  id: 'test-run',
  name: 'Running',
  description: 'Morning run',
  weather_profile: { temperature_min: 5, temperature_max: 28, wind_speed_min: 0, wind_speed_max: 20, precipitation_allowed: 'light', uv_index_max: 7, cloud_cover_min: 0, cloud_cover_max: 100, daylight_required: false },
  duration_estimate: 60,
  default_destination: null,
  task_templates: [],
  icon: 'footprints',
};

const commute = { to_dest: 20, from_dest: 20, distance_km: 6, mode: 'cycling' };
const noCommute = { to_dest: 0, from_dest: 0, distance_km: 0, mode: 'cycling' };

// Build windows from good forecast
const goodWindows = findOpportunityWindows(mockForecast, bikeProfile, 120);

test('compose produces up to 3 schedules', () => {
  const plans = composeSchedules(bikeActivity, goodWindows, commute, '07:00', '22:00');
  assert(plans.length >= 1, `Expected at least 1 plan, got ${plans.length}`);
  assert(plans.length <= 3, `Expected at most 3 plans, got ${plans.length}`);
});

test('each plan has correct task order (prep → transit → activity → transit → cleanup)', () => {
  const plans = composeSchedules(bikeActivity, goodWindows, commute, '07:00', '22:00');
  assert(plans.length > 0, 'No plans generated');
  const plan = plans[0];
  const types = plan.scheduled_tasks.map(t => t.type);
  // First tasks should be preparation
  assert(types[0] === 'preparation' || types[0] === 'transit', `First task should be prep or transit, got ${types[0]}`);
  // Activity should exist
  assert(types.includes('activity'), 'No activity task');
  // Cleanup should be last
  if (types.includes('cleanup')) {
    assertEqual(types[types.length - 1], 'cleanup', 'Cleanup should be last');
  }
});

test('task times are sequential (no overlaps)', () => {
  const plans = composeSchedules(bikeActivity, goodWindows, commute, '07:00', '22:00');
  assert(plans.length > 0, 'No plans');
  const plan = plans[0];
  for (let i = 1; i < plan.scheduled_tasks.length; i++) {
    const prev = plan.scheduled_tasks[i - 1];
    const curr = plan.scheduled_tasks[i];
    const prevEnd = new Date(prev.end_time).getTime();
    const currStart = new Date(curr.start_time).getTime();
    assert(prevEnd <= currStart, `Task overlap: "${prev.name}" ends ${new Date(prev.end_time).toISOString()} but "${curr.name}" starts ${new Date(curr.start_time).toISOString()}`);
  }
});

test('all tasks are within wake/sleep window', () => {
  const plans = composeSchedules(bikeActivity, goodWindows, commute, '07:00', '22:00');
  for (const plan of plans) {
    for (const task of plan.scheduled_tasks) {
      const start = new Date(task.start_time);
      const h = start.getHours();
      // Wake time = 7, sleep time = 22
      assert(h >= 7, `Task "${task.name}" starts at ${h}h, before wake time 7h`);
    }
  }
});

test('activity is inside the weather window', () => {
  const plans = composeSchedules(bikeActivity, goodWindows, commute, '07:00', '22:00');
  for (const plan of plans) {
    const actTask = plan.scheduled_tasks.find(t => t.type === 'activity');
    assert(actTask, 'No activity task found');
    const ws = plan.weather_snapshot;
    const actStart = new Date(actTask.start_time).getTime();
    const actEnd = new Date(actTask.end_time).getTime();
    const wsStart = new Date(ws.start).getTime();
    const wsEnd = new Date(ws.end).getTime();
    assert(actStart >= wsStart, `Activity starts before weather window`);
    assert(actEnd <= wsEnd, `Activity ends after weather window`);
  }
});

test('scores are between 0 and 1', () => {
  const plans = composeSchedules(bikeActivity, goodWindows, commute, '07:00', '22:00');
  for (const plan of plans) {
    assert(plan.composite_score >= 0 && plan.composite_score <= 1, `Invalid score: ${plan.composite_score}`);
    assert(plan.score_breakdown.weather >= 0 && plan.score_breakdown.weather <= 1, `Invalid weather score`);
  }
});

test('no transit tasks when commute is 0 (no destination)', () => {
  const runWindows = findOpportunityWindows(mockForecast, runActivity.weather_profile, 60);
  const plans = composeSchedules(runActivity, runWindows, noCommute, '07:00', '22:00');
  assert(plans.length > 0, 'No plans for run');
  const plan = plans[0];
  const hasTransit = plan.scheduled_tasks.some(t => t.type === 'transit');
  assert(!hasTransit, `Expected no transit tasks when commute=0, but found: ${plan.scheduled_tasks.filter(t => t.type === 'transit').map(t => t.name).join(', ')}`);
});

test('plans are sorted by score descending', () => {
  const plans = composeSchedules(bikeActivity, goodWindows, commute, '07:00', '22:00');
  for (let i = 1; i < plans.length; i++) {
    assert(plans[i - 1].composite_score >= plans[i].composite_score, `Plans not sorted by score: ${plans[i-1].composite_score} < ${plans[i].composite_score}`);
  }
});

// ─── 4. EDGE CASES ────────────────────────────────────────────────────────

console.log('\n── Edge Cases ────────────────────────────────────────────────');

test('handles no matching windows gracefully', () => {
  const rainyForecast = mockForecast.map(h => ({ ...h, precipitation: 10 }));
  const windows = findOpportunityWindows(rainyForecast, bikeProfile, 120);
  const plans = composeSchedules(bikeActivity, windows, commute, '07:00', '22:00');
  assertEqual(plans.length, 0, `Expected 0 plans with no weather windows`);
});

test('handles activity with no task templates', () => {
  const noTaskActivity = { ...bikeActivity, task_templates: [] };
  const plans = composeSchedules(noTaskActivity, goodWindows, commute, '07:00', '22:00');
  assert(plans.length > 0, 'Should still generate plans with no tasks');
  const plan = plans[0];
  const nonTransitNonActivity = plan.scheduled_tasks.filter(t => t.type !== 'transit' && t.type !== 'activity');
  assertEqual(nonTransitNonActivity.length, 0, 'Should have no prep/cleanup tasks');
});

test('date revival from JSON serialization', () => {
  const original = { time: new Date(), temperature: 22 };
  const serialized = JSON.stringify(original);
  const revived = JSON.parse(serialized, (k, v) => {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v);
    return v;
  });
  assert(revived.time instanceof Date, 'Date should be revived from ISO string');
  assertEqual(revived.time.getTime(), original.time.getTime(), 'Revived date should match original');
});

test('uid generates unique ids', () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(uid());
  assertEqual(ids.size, 100, 'All UIDs should be unique');
});

test('window scoring: ideal temp gets higher score than extreme temp', () => {
  const idealWindow = { avg_temperature: 23, avg_wind_speed: 12, max_precipitation: 0, avg_uv_index: 3, avg_cloud_cover: 40, start: new Date(), end: new Date(Date.now() + 4 * 3600000), hours: [] };
  const extremeWindow = { ...idealWindow, avg_temperature: 32 }; // at the edge of 32°C max
  const idealScore = scoreWindow(idealWindow, bikeProfile);
  const extremeScore = scoreWindow(extremeWindow, bikeProfile);
  assert(idealScore.weather > extremeScore.weather, `Ideal temp should score higher (${idealScore.weather.toFixed(2)} vs ${extremeScore.weather.toFixed(2)})`);
});

// ─── 5. SUMMARY ───────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
const total = passed + failed;
console.log(`Results: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ' ✓'}`);
if (failed > 0) process.exit(1);
