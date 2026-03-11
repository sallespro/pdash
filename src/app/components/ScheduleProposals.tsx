import { Sun, Cloud, CloudRain, Wind, Thermometer, Droplets, Clock, MapPin, Check, ArrowLeft, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import type { ScheduledPlan, Activity, CommuteEstimate } from '../types';
import { weatherCodeToLabel } from '../services/weather';
import { explainScheduleAI, type AIScheduleExplanation } from '../services/aiClient';

interface ScheduleProposalsProps {
  proposals: ScheduledPlan[];
  activity: Activity;
  commute: CommuteEstimate | null;
  onSelect: (plan: ScheduledPlan) => void;
  onDismiss: () => void;
  loading?: boolean;
}

function weatherIcon(code: number, className = 'size-5') {
  if (code === 0) return <Sun className={className + ' text-amber-500'} />;
  if (code <= 3) return <Cloud className={className + ' text-gray-500'} />;
  if (code <= 69) return <CloudRain className={className + ' text-blue-500'} />;
  return <Cloud className={className + ' text-gray-400'} />;
}

function scoreColor(score: number): string {
  if (score >= 0.7) return 'bg-green-100 text-green-700';
  if (score >= 0.4) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(d: Date): string {
  const date = new Date(d);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const TYPE_COLORS: Record<string, string> = {
  preparation: 'border-l-amber-400 bg-amber-50',
  transit: 'border-l-blue-400 bg-blue-50',
  activity: 'border-l-green-400 bg-green-50',
  cleanup: 'border-l-gray-400 bg-gray-50',
};

const TYPE_LABELS: Record<string, string> = {
  preparation: 'PREP',
  transit: 'TRAVEL',
  activity: 'ACTIVITY',
  cleanup: 'CLEANUP',
};

export function ScheduleProposals({
  proposals, activity, commute, onSelect, onDismiss, loading,
}: ScheduleProposalsProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={onDismiss} className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">Finding best times...</h2>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="inline-block size-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm mt-3">Checking weather for {activity.name}...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={onDismiss} className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">No good windows found</h2>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <CloudRain className="size-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Weather conditions don't match {activity.name} requirements in the next 3 days.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Try adjusting the weather profile or check back later.
            </p>
          </CardContent>
        </Card>
        <Button variant="outline" className="w-full rounded-full" onClick={onDismiss}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <ScheduleProposalsInner
      proposals={proposals}
      activity={activity}
      commute={commute}
      onSelect={onSelect}
      onDismiss={onDismiss}
    />
  );
}

function ScheduleProposalsInner({
  proposals, activity, commute, onSelect, onDismiss,
}: {
  proposals: ScheduledPlan[];
  activity: Activity;
  commute: CommuteEstimate | null;
  onSelect: (plan: ScheduledPlan) => void;
  onDismiss: () => void;
}) {
  const [explanations, setExplanations] = useState<Record<string, AIScheduleExplanation>>({});

  useEffect(() => {
    // Fetch AI explanations for all proposals in parallel
    proposals.forEach(plan => {
      explainScheduleAI({
        activity_name: activity.name,
        weather_snapshot: plan.weather_snapshot,
        score_breakdown: plan.score_breakdown,
      }).then(result => {
        if (result) {
          setExplanations(prev => ({ ...prev, [plan.id]: result }));
        }
      });
    });
  }, [proposals, activity.name]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onDismiss} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Best times for {activity.name}</h2>
          <p className="text-xs text-gray-500">Select one to schedule</p>
        </div>
      </div>

      {/* Commute info */}
      {commute && (
        <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
          <MapPin className="size-3" />
          <span>{commute.distance_km} km by {commute.mode} ({commute.to_dest} min each way)</span>
        </div>
      )}

      {proposals.map((plan, index) => {
        const ws = plan.weather_snapshot;
        const dominantCode = ws.hours[Math.floor(ws.hours.length / 2)]?.weather_code || 0;

        return (
          <Card key={plan.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Header with weather */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {weatherIcon(dominantCode, 'size-8')}
                <div>
                  <p className="font-semibold text-sm">{formatDay(ws.start)}</p>
                  <p className="text-xs text-gray-500">{weatherCodeToLabel(dominantCode)}</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreColor(plan.composite_score)}`}>
                {Math.round(plan.composite_score * 100)}%
              </span>
            </div>

            {/* Weather details */}
            <div className="px-5 py-2 flex gap-4 text-xs text-gray-600 border-b">
              <span className="flex items-center gap-1">
                <Thermometer className="size-3" /> {Math.round(ws.avg_temperature)}°C
              </span>
              <span className="flex items-center gap-1">
                <Wind className="size-3" /> {Math.round(ws.avg_wind_speed)} km/h
              </span>
              <span className="flex items-center gap-1">
                <Droplets className="size-3" /> {ws.max_precipitation} mm
              </span>
            </div>

            {/* AI Explanation */}
            {explanations[plan.id] ? (
              <div className="px-5 py-2 bg-indigo-50 border-b flex gap-2">
                <Sparkles className="size-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-indigo-700">{explanations[plan.id].explanation}</p>
                  <span className="text-[10px] text-indigo-400 italic">{explanations[plan.id].highlight}</span>
                </div>
              </div>
            ) : (
              <div className="px-5 py-1.5 bg-indigo-50/40 border-b flex items-center gap-2">
                <Sparkles className="size-3 text-indigo-300 animate-pulse" />
                <span className="text-[10px] text-indigo-300">AI analyzing conditions...</span>
              </div>
            )}

            {/* Task timeline */}
            <CardContent className="py-3">
              <div className="space-y-1.5">
                {plan.scheduled_tasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border-l-4 ${TYPE_COLORS[task.type]}`}
                  >
                    <div className="w-20 text-[10px] font-mono text-gray-500 shrink-0">
                      {formatTime(task.start_time)}
                      <br />
                      {formatTime(task.end_time)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.name}</p>
                      <span className="text-[10px] text-gray-400 uppercase">{TYPE_LABELS[task.type]}</span>
                    </div>
                    <Clock className="size-3 text-gray-300 shrink-0" />
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {Math.round((new Date(task.end_time).getTime() - new Date(task.start_time).getTime()) / 60000)} min
                    </span>
                  </div>
                ))}
              </div>

              {/* Total time */}
              {plan.scheduled_tasks.length > 0 && (
                <div className="mt-3 pt-2 border-t flex justify-between text-xs text-gray-500">
                  <span>
                    Start: {formatTime(plan.scheduled_tasks[0].start_time)}
                  </span>
                  <span>
                    End: {formatTime(plan.scheduled_tasks[plan.scheduled_tasks.length - 1].end_time)}
                  </span>
                </div>
              )}
            </CardContent>

            {/* Select button */}
            <div className="px-5 pb-4">
              <Button
                className="w-full rounded-full gap-2"
                onClick={() => onSelect(plan)}
              >
                <Check className="size-4" /> Select this schedule
              </Button>
            </div>
          </Card>
        );
      })}

      <Button variant="outline" className="w-full rounded-full" onClick={onDismiss}>
        Cancel
      </Button>
    </div>
  );
}
