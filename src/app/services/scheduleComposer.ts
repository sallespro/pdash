import type { Activity, OpportunityWindow, CommuteEstimate, ScheduledPlan, ScheduledTask } from '../types';
import { scoreWindow } from './weather';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function composeSchedules(
  activity: Activity,
  windows: OpportunityWindow[],
  commute: CommuteEstimate,
  wakeTime: string,
  sleepTime: string
): ScheduledPlan[] {
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  const [sleepH, sleepM] = sleepTime.split(':').map(Number);

  const candidates: ScheduledPlan[] = [];

  for (const window of windows) {
    const plan = buildPlanForWindow(activity, window, commute, wakeH, wakeM, sleepH, sleepM);
    if (plan) candidates.push(plan);
  }

  // Sort by composite score descending
  candidates.sort((a, b) => b.composite_score - a.composite_score);

  // Return top 3, ensuring different days if possible
  const result: ScheduledPlan[] = [];
  const usedDays = new Set<string>();

  for (const plan of candidates) {
    const dayKey = plan.weather_snapshot.start.toDateString();
    if (result.length < 3) {
      // Prefer different days but accept same day if needed
      if (!usedDays.has(dayKey) || result.length < 3) {
        result.push(plan);
        usedDays.add(dayKey);
      }
    }
  }

  return result;
}

function buildPlanForWindow(
  activity: Activity,
  window: OpportunityWindow,
  commute: CommuteEstimate,
  wakeH: number,
  wakeM: number,
  sleepH: number,
  sleepM: number
): ScheduledPlan | null {
  const planId = uid();
  const tasks: ScheduledTask[] = [];

  // Total time needed inside the window: commute_to + activity + commute_from
  const activityMinutes = activity.duration_estimate;
  const totalWindowMinutes = commute.to_dest + activityMinutes + commute.from_dest;

  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();
  const windowDuration = (windowEnd - windowStart) / (1000 * 60);

  if (windowDuration < totalWindowMinutes) return null;

  // Center the activity block in the window
  const slack = windowDuration - totalWindowMinutes;
  const offsetMinutes = Math.floor(slack / 2);
  const transitStartTime = windowStart + offsetMinutes * 60 * 1000;

  // Transit to destination (skip if no commute)
  const transitToStart = new Date(transitStartTime);
  const transitToEnd = new Date(transitStartTime + commute.to_dest * 60 * 1000);
  if (commute.to_dest > 0) {
    tasks.push({
      id: uid(),
      plan_id: planId,
      template_id: '__transit_to',
      name: `Commute to ${activity.default_destination?.name || 'destination'}`,
      type: 'transit',
      start_time: transitToStart,
      end_time: transitToEnd,
      status: 'pending',
      location: activity.default_destination,
    });
  }

  // Activity
  const activityStart = transitToEnd;
  const activityEnd = new Date(activityStart.getTime() + activityMinutes * 60 * 1000);
  tasks.push({
    id: uid(),
    plan_id: planId,
    template_id: '__activity',
    name: activity.name,
    type: 'activity',
    start_time: activityStart,
    end_time: activityEnd,
    status: 'pending',
    location: activity.default_destination,
  });

  // Transit back (skip if no commute)
  const transitBackStart = activityEnd;
  const transitBackEnd = new Date(activityEnd.getTime() + commute.from_dest * 60 * 1000);
  if (commute.from_dest > 0) {
    tasks.push({
      id: uid(),
      plan_id: planId,
      template_id: '__transit_back',
      name: 'Commute back home',
      type: 'transit',
      start_time: transitBackStart,
      end_time: transitBackEnd,
      status: 'pending',
      location: null,
    });
  }

  // Back-fill preparation tasks
  const prepTasks = activity.task_templates
    .filter(t => t.type === 'preparation')
    .sort((a, b) => b.lead_time - a.lead_time);

  let earliestStart = transitToStart.getTime();
  for (const template of prepTasks) {
    const taskEnd = new Date(earliestStart);
    const taskStart = new Date(earliestStart - template.duration_estimate * 60 * 1000);

    // Check wake time
    const dayStart = new Date(taskStart);
    dayStart.setHours(wakeH, wakeM, 0, 0);
    if (taskStart.getTime() < dayStart.getTime()) return null;

    tasks.unshift({
      id: uid(),
      plan_id: planId,
      template_id: template.id,
      name: template.name,
      type: 'preparation',
      start_time: taskStart,
      end_time: taskEnd,
      status: 'pending',
      location: null,
    });

    earliestStart = taskStart.getTime();
  }

  // Append cleanup tasks (return time: after transit if exists, else after activity)
  let latestEnd = commute.from_dest > 0 ? transitBackEnd.getTime() : activityEnd.getTime();
  const cleanupTasks = activity.task_templates.filter(t => t.type === 'cleanup');
  for (const template of cleanupTasks) {
    const taskStart = new Date(latestEnd);
    const taskEnd = new Date(latestEnd + template.duration_estimate * 60 * 1000);

    // Check sleep time
    const daySleep = new Date(taskEnd);
    daySleep.setHours(sleepH, sleepM, 0, 0);
    if (taskEnd.getTime() > daySleep.getTime()) return null;

    tasks.push({
      id: uid(),
      plan_id: planId,
      template_id: template.id,
      name: template.name,
      type: 'cleanup',
      start_time: taskStart,
      end_time: taskEnd,
      status: 'pending',
      location: null,
    });

    latestEnd = taskEnd.getTime();
  }

  const scores = scoreWindow(window, activity.weather_profile);

  return {
    id: planId,
    activity_id: activity.id,
    status: 'proposed',
    weather_snapshot: window,
    destination: activity.default_destination || { lat: 0, lng: 0, address: '', name: 'TBD' },
    scheduled_tasks: tasks,
    composite_score: scores.composite,
    score_breakdown: {
      weather: scores.weather,
      time: scores.time,
      convenience: scores.convenience,
    },
  };
}
