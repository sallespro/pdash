import { ArrowLeft, Check, SkipForward, AlertTriangle, X, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { ScheduledPlan, Activity } from '../types';
import { weatherCodeToLabel } from '../services/weather';

interface ActiveScheduleProps {
  plan: ScheduledPlan;
  activity: Activity | undefined;
  onUpdateTask: (taskId: string, status: 'done' | 'skipped' | 'in_progress') => void;
  onCancel: () => void;
  onBack: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  reminded: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-400 line-through',
};

const TYPE_BORDER: Record<string, string> = {
  preparation: 'border-l-amber-400',
  transit: 'border-l-blue-400',
  activity: 'border-l-green-500',
  cleanup: 'border-l-gray-400',
};

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

export function ActiveSchedule({ plan, activity, onUpdateTask, onCancel, onBack }: ActiveScheduleProps) {
  const ws = plan.weather_snapshot;
  const activityTask = plan.scheduled_tasks.find(t => t.type === 'activity');
  const allDone = plan.scheduled_tasks.every(t => t.status === 'done' || t.status === 'skipped');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onBack} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{activity?.name || 'Schedule'}</h2>
          {activityTask && (
            <p className="text-xs text-gray-500">{formatDate(activityTask.start_time)}</p>
          )}
        </div>
      </div>

      {/* Weather summary */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-0">
        <CardContent className="py-3">
          <div className="flex justify-between items-center text-sm">
            <span>{Math.round(ws.avg_temperature)}°C - {weatherCodeToLabel(ws.hours[0]?.weather_code || 0)}</span>
            <span className="text-xs text-gray-500">
              Wind: {Math.round(ws.avg_wind_speed)} km/h
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Task timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500 font-medium">Schedule Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {plan.scheduled_tasks.map((task, i) => {
              const isActive = task.status === 'pending' || task.status === 'reminded' || task.status === 'in_progress';
              const now = Date.now();
              const start = new Date(task.start_time).getTime();
              const end = new Date(task.end_time).getTime();
              const isCurrent = now >= start && now <= end && task.status !== 'done' && task.status !== 'skipped';

              return (
                <div
                  key={task.id}
                  className={`relative flex gap-3 p-3 rounded-lg border-l-4 ${TYPE_BORDER[task.type]} ${
                    isCurrent ? 'ring-2 ring-indigo-300 bg-indigo-50' : 'bg-gray-50'
                  } ${task.status === 'skipped' ? 'opacity-50' : ''}`}
                >
                  {/* Time column */}
                  <div className="w-16 shrink-0 text-xs font-mono text-gray-500">
                    <div>{formatTime(task.start_time)}</div>
                    <div>{formatTime(task.end_time)}</div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'skipped' ? 'line-through text-gray-400' : ''}`}>
                      {task.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLES[task.status]}`}>
                        {task.status}
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Clock className="size-2.5" />
                        {Math.round((end - start) / 60000)} min
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {isActive && (
                    <div className="flex gap-1 shrink-0">
                      {task.status !== 'in_progress' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-blue-500"
                          onClick={() => onUpdateTask(task.id, 'in_progress')}
                          title="Start"
                        >
                          <Clock className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-green-500"
                        onClick={() => onUpdateTask(task.id, 'done')}
                        title="Done"
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-gray-400"
                        onClick={() => onUpdateTask(task.id, 'skipped')}
                        title="Skip"
                      >
                        <SkipForward className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {allDone && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-4 text-center">
            <Check className="size-8 text-green-500 mx-auto mb-2" />
            <p className="text-green-700 font-medium">All done! Great ride!</p>
          </CardContent>
        </Card>
      )}

      <Button
        variant="destructive"
        className="w-full rounded-full gap-2"
        onClick={onCancel}
      >
        <X className="size-4" /> Cancel Schedule
      </Button>
    </div>
  );
}
