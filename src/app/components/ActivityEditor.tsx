import { useState } from 'react';
import { Plus, Trash2, GripVertical, ArrowLeft, MapPin, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { Activity, WeatherProfile, TaskTemplate, Location } from '../types';
import { getDefaultProfile, getActivityIcon, createTaskTemplate } from '../store/useStore';
import { geocodeAddress } from '../services/routing';
import { configureActivityAI } from '../services/aiClient';

interface ActivityEditorProps {
  activity?: Activity;
  onSave: (activity: Omit<Activity, 'id'> | Activity) => void;
  onCancel: () => void;
  initialName?: string;
  initialTasks?: string[];
  initialWeatherHints?: string[];
  initialDuration?: number;
  rawDescription?: string; // original voice transcript
}

export function ActivityEditor({
  activity,
  onSave,
  onCancel,
  initialName = '',
  initialTasks = [],
  initialWeatherHints = [],
  initialDuration,
  rawDescription,
}: ActivityEditorProps) {
  const defaultProfile = getDefaultProfile(activity?.name || initialName);

  const [name, setName] = useState(activity?.name || initialName);
  const [description, setDescription] = useState(activity?.description || rawDescription || '');
  const [duration, setDuration] = useState(activity?.duration_estimate || initialDuration || 120);
  const [destination, setDestination] = useState<Location | null>(activity?.default_destination || null);
  const [destQuery, setDestQuery] = useState('');
  const [searchingDest, setSearchingDest] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [profile, setProfile] = useState<WeatherProfile>(
    activity?.weather_profile || { ...defaultProfile }
  );

  const [tasks, setTasks] = useState<TaskTemplate[]>(() => {
    if (activity?.task_templates.length) return activity.task_templates;
    // Create from initial hints
    return initialTasks.map((t, i) =>
      createTaskTemplate('__draft', t, 'preparation', 30, (initialTasks.length - i) * 30)
    );
  });

  const [newTaskName, setNewTaskName] = useState('');

  const handleAIAutoFill = async () => {
    const desc = description || rawDescription || name;
    if (!desc.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const config = await configureActivityAI(desc, name);
      if (!config) {
        setAiError('AI server unavailable. Run: npm run server');
        return;
      }
      setProfile(config.weather_profile);
      setDuration(config.duration_estimate);
      if (config.description) setDescription(config.description);
      setTasks(
        config.task_templates.map((t, i) =>
          createTaskTemplate('__draft', t.name, t.type, t.duration_estimate, t.lead_time)
        )
      );
    } catch (err: any) {
      setAiError(err.message);
    }
    setAiLoading(false);
  };

  const handleSearchDest = async () => {
    if (!destQuery.trim()) return;
    setSearchingDest(true);
    const loc = await geocodeAddress(destQuery);
    if (loc) setDestination(loc);
    setSearchingDest(false);
  };

  const addTask = (type: TaskTemplate['type'] = 'preparation') => {
    if (!newTaskName.trim()) return;
    setTasks(prev => [
      ...prev,
      createTaskTemplate('__draft', newTaskName.trim(), type, 30, type === 'preparation' ? 60 : 0),
    ]);
    setNewTaskName('');
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = (id: string, updates: Partial<TaskTemplate>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const data = {
      ...(activity ? { id: activity.id } : {}),
      name: name.trim(),
      description,
      weather_profile: profile,
      duration_estimate: duration,
      default_destination: destination,
      task_templates: tasks,
      icon: getActivityIcon(name.trim()),
    };
    onSave(data as any);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onCancel} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {activity ? 'Edit Activity' : 'New Activity'}
        </h2>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Activity Name</label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Bike Ride"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe how you like to do this activity. The more detail, the better the AI can configure it for you."
            />
          </div>

          {/* AI Auto-fill */}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 rounded-full border-indigo-300 text-indigo-600 hover:bg-indigo-50"
              onClick={handleAIAutoFill}
              disabled={aiLoading || (!description && !rawDescription && !name)}
            >
              {aiLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {aiLoading ? 'AI is configuring...' : 'Auto-fill with AI'}
            </Button>
            {aiError && (
              <p className="text-xs text-red-500 mt-1 text-center">{aiError}</p>
            )}
            <p className="text-xs text-gray-400 mt-1 text-center">
              Fills weather profile and task list from your description
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Duration (minutes)</label>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              min={15}
              step={15}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Destination</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={destQuery}
                onChange={e => setDestQuery(e.target.value)}
                placeholder="Search for a place..."
                onKeyDown={e => e.key === 'Enter' && handleSearchDest()}
              />
              <Button size="sm" onClick={handleSearchDest} disabled={searchingDest}>
                <MapPin className="size-4" />
              </Button>
            </div>
            {destination && (
              <p className="text-xs text-green-600 mt-1 truncate">{destination.address}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weather Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Weather Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RangeRow
            label="Temperature"
            unit="°C"
            min={-10} max={45}
            valueMin={profile.temperature_min}
            valueMax={profile.temperature_max}
            onChangeMin={v => setProfile(p => ({ ...p, temperature_min: v }))}
            onChangeMax={v => setProfile(p => ({ ...p, temperature_max: v }))}
          />
          <RangeRow
            label="Wind Speed"
            unit="km/h"
            min={0} max={60}
            valueMin={profile.wind_speed_min}
            valueMax={profile.wind_speed_max}
            onChangeMin={v => setProfile(p => ({ ...p, wind_speed_min: v }))}
            onChangeMax={v => setProfile(p => ({ ...p, wind_speed_max: v }))}
          />
          <div>
            <label className="text-xs text-gray-500">Max UV Index</label>
            <input
              type="range"
              min={1} max={11} step={1}
              value={profile.uv_index_max}
              onChange={e => setProfile(p => ({ ...p, uv_index_max: Number(e.target.value) }))}
              className="w-full accent-indigo-500"
            />
            <span className="text-xs text-gray-600">{profile.uv_index_max}</span>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Rain</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={profile.precipitation_allowed}
              onChange={e => setProfile(p => ({ ...p, precipitation_allowed: e.target.value as any }))}
            >
              <option value="none">No rain</option>
              <option value="light">Light rain OK</option>
              <option value="any">Any</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.daylight_required}
              onChange={e => setProfile(p => ({ ...p, daylight_required: e.target.checked }))}
              className="accent-indigo-500"
            />
            Daylight required
          </label>
        </CardContent>
      </Card>

      {/* Task Chain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Preparation & Cleanup Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
              <GripVertical className="size-4 text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <input
                  className="w-full text-sm bg-transparent focus:outline-none"
                  value={task.name}
                  onChange={e => updateTask(task.id, { name: e.target.value })}
                />
                <div className="flex gap-2 mt-1">
                  <select
                    className="text-[10px] border rounded px-1 py-0.5"
                    value={task.type}
                    onChange={e => updateTask(task.id, { type: e.target.value as any })}
                  >
                    <option value="preparation">Prep</option>
                    <option value="cleanup">Cleanup</option>
                  </select>
                  <input
                    type="number"
                    className="text-[10px] border rounded px-1 py-0.5 w-16"
                    value={task.duration_estimate}
                    onChange={e => updateTask(task.id, { duration_estimate: Number(e.target.value) })}
                    min={5}
                    step={5}
                  />
                  <span className="text-[10px] text-gray-400">min</span>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="size-7 text-red-400" onClick={() => removeTask(task.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              placeholder="Add a task..."
              onKeyDown={e => e.key === 'Enter' && addTask()}
            />
            <Button size="sm" onClick={() => addTask()}>
              <Plus className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 rounded-full" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1 rounded-full" onClick={handleSave} disabled={!name.trim()}>
          {activity ? 'Update' : 'Create'} Activity
        </Button>
      </div>
    </div>
  );
}

function RangeRow({
  label, unit, min, max, valueMin, valueMax, onChangeMin, onChangeMax,
}: {
  label: string; unit: string; min: number; max: number;
  valueMin: number; valueMax: number;
  onChangeMin: (v: number) => void; onChangeMax: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label} ({unit})</label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="number"
          className="w-16 rounded border px-2 py-1 text-sm text-center"
          value={valueMin}
          onChange={e => onChangeMin(Number(e.target.value))}
          min={min}
          max={valueMax}
        />
        <span className="text-gray-400 text-xs">to</span>
        <input
          type="number"
          className="w-16 rounded border px-2 py-1 text-sm text-center"
          value={valueMax}
          onChange={e => onChangeMax(Number(e.target.value))}
          min={valueMin}
          max={max}
        />
      </div>
    </div>
  );
}
