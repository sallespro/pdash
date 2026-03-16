import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, Wind, Droplets, Thermometer, MapPin, RefreshCw, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ActivityPostsTicker } from './ActivityPostsTicker';
import type { HourlyWeather, Location, ScheduledPlan, Activity } from '../types';
import { fetchForecast, weatherCodeToLabel } from '../services/weather';

interface DashboardProps {
  location: Location | null;
  confirmedPlans: ScheduledPlan[];
  activities: Activity[];
  onSelectPlan: (plan: ScheduledPlan) => void;
}

function weatherIcon(code: number, className = 'size-5') {
  if (code === 0) return <Sun className={className + ' text-amber-500'} />;
  if (code <= 3) return <Cloud className={className + ' text-gray-500'} />;
  if (code <= 69) return <CloudRain className={className + ' text-blue-500'} />;
  return <Cloud className={className + ' text-gray-400'} />;
}

export function Dashboard({ location, confirmedPlans, activities, onSelectPlan }: DashboardProps) {
  const [forecast, setForecast] = useState<HourlyWeather[]>([]);
  const [loading, setLoading] = useState(false);

  const loadForecast = async () => {
    if (!location) return;
    setLoading(true);
    try {
      const data = await fetchForecast(location);
      setForecast(data);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    loadForecast();
  }, [location?.lat, location?.lng]);

  const now = new Date();
  // Find the entry closest in time to now (OWM slots can start hours ahead of current time)
  const currentHour = forecast.length > 0
    ? forecast.reduce((a, b) =>
        Math.abs(a.time.getTime() - now.getTime()) <= Math.abs(b.time.getTime() - now.getTime()) ? a : b
      )
    : undefined;

  // Next 12 hours
  const next12 = forecast.filter(h => {
    const diff = h.time.getTime() - now.getTime();
    return diff >= 0 && diff < 12 * 3600000;
  });

  // 3-day summary
  const dailySummary = getDailySummary(forecast);

  // Upcoming confirmed plans (next 48h)
  const upcomingPlans = confirmedPlans.filter(p => {
    const firstTask = p.scheduled_tasks[0];
    if (!firstTask) return false;
    const diff = new Date(firstTask.start_time).getTime() - now.getTime();
    return diff >= -3600000 && diff < 48 * 3600000;
  });

  return (
    <div className="space-y-5">
      {/* Top Row: Weather + Activity Posts Ticker side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Current Weather */}
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm text-white/90">Weather</CardTitle>
                {location && (
                  <p className="text-white/70 text-[10px] mt-0.5 flex items-center gap-1">
                    <MapPin className="size-2.5" />
                    {location.name || location.address.split(',')[0]}
                  </p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 size-7"
                onClick={loadForecast}
                disabled={loading}
              >
                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {currentHour ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {weatherIcon(currentHour.weather_code, 'size-8')}
                  <div>
                    <p className="text-3xl font-light leading-none">{Math.round(currentHour.temperature)}°</p>
                    <p className="text-white/80 text-[10px] mt-0.5">{weatherCodeToLabel(currentHour.weather_code)}</p>
                  </div>
                </div>
                <div className="space-y-0.5 text-[10px] text-white/70">
                  <p className="flex items-center gap-1">
                    <Wind className="size-3" /> {Math.round(currentHour.wind_speed)} km/h
                  </p>
                  <p className="flex items-center gap-1">
                    <Droplets className="size-3" /> {currentHour.precipitation} mm
                  </p>
                  <p className="flex items-center gap-1">
                    <Thermometer className="size-3" /> UV {currentHour.uv_index.toFixed(1)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-white/60 text-xs">
                {location ? 'Loading...' : 'Set location in Settings'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Activity Posts Ticker */}
        <ActivityPostsTicker />
      </div>

      {/* Hourly forecast */}
      {next12.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 font-medium">Next 12 Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {next12.map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-1 min-w-[52px]">
                  <span className="text-xs text-gray-500">
                    {h.time.getHours().toString().padStart(2, '0')}:00
                  </span>
                  {weatherIcon(h.weather_code, 'size-4')}
                  <span className="text-sm font-medium">{Math.round(h.temperature)}°</span>
                  {h.precipitation > 0 && (
                    <span className="text-[10px] text-blue-500">{h.precipitation}mm</span>
                  )}
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    <Navigation
                      className="size-2.5 shrink-0"
                      style={{ transform: `rotate(${h.wind_direction + 180}deg)` }}
                    />
                    <span>{Math.round(h.wind_speed)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5-Day Forecast */}
      {dailySummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 font-medium">5-Day Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dailySummary.map((day, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-sm w-20">{day.label}</span>
                  {weatherIcon(day.code, 'size-4')}
                  <span className="text-sm text-gray-500">{weatherCodeToLabel(day.code)}</span>
                  <span className="text-sm font-medium">
                    {Math.round(day.min)}° / {Math.round(day.max)}°
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Schedules */}
      {upcomingPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 font-medium">Upcoming Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingPlans.map(plan => {
                const activity = activities.find(a => a.id === plan.activity_id);
                const activityTask = plan.scheduled_tasks.find(t => t.type === 'activity');
                return (
                  <button
                    key={plan.id}
                    onClick={() => onSelectPlan(plan)}
                    className="w-full text-left p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
                  >
                    <p className="font-medium text-sm">{activity?.name || 'Activity'}</p>
                    {activityTask && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDateTime(new Date(activityTask.start_time))} - {formatTime(new Date(activityTask.end_time))}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getDailySummary(forecast: HourlyWeather[]) {
  const days = new Map<string, HourlyWeather[]>();
  for (const h of forecast) {
    const key = h.time.toDateString();
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(h);
  }

  const result: { label: string; min: number; max: number; code: number }[] = [];
  const today = new Date().toDateString();
  const tomorrow = new Date(Date.now() + 86400000).toDateString();

  for (const [dateStr, hours] of days) {
    const temps = hours.map(h => h.temperature);
    const codes = hours.map(h => h.weather_code);
    const midday = codes[Math.floor(codes.length / 2)] || codes[0];

    let label = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
    if (dateStr === today) label = 'Today';
    else if (dateStr === tomorrow) label = 'Tomorrow';

    result.push({
      label,
      min: Math.min(...temps),
      max: Math.max(...temps),
      code: midday,
    });
  }

  return result;
}

function formatDateTime(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' ' + formatTime(d);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
