import { Bike, Waves, Wind, Mountain, Footprints, Utensils, Activity as ActivityIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { Activity } from '../types';

interface ActivityLibraryProps {
  activities: Activity[];
  onSelect: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  bike: <Bike className="size-5" />,
  waves: <Waves className="size-5" />,
  wind: <Wind className="size-5" />,
  mountain: <Mountain className="size-5" />,
  footprints: <Footprints className="size-5" />,
  utensils: <Utensils className="size-5" />,
  activity: <ActivityIcon className="size-5" />,
};

function precipLabel(val: string) {
  if (val === 'none') return 'No rain';
  if (val === 'light') return 'Light rain OK';
  return 'Any weather';
}

export function ActivityLibrary({ activities, onSelect, onEdit, onDelete, onNew }: ActivityLibraryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activities</h2>
        <Button size="sm" onClick={onNew} className="gap-1.5 rounded-full">
          <Plus className="size-4" /> New
        </Button>
      </div>

      {activities.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <ActivityIcon className="size-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No activities yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Tap the mic and say "I like to ride my bike" to create one
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {activities.map(activity => (
          <Card key={activity.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="size-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  {ICON_MAP[activity.icon] || ICON_MAP.activity}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{activity.name}</h3>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => onEdit(activity)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-red-500" onClick={() => onDelete(activity.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {activity.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {activity.duration_estimate} min
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {precipLabel(activity.weather_profile.precipitation_allowed)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {activity.task_templates.filter(t => t.type === 'preparation').length} prep tasks
                    </span>
                    {activity.default_destination && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {activity.default_destination.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick action */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3 rounded-full text-xs"
                onClick={() => onSelect(activity)}
              >
                Find best time to {activity.name.toLowerCase()}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
