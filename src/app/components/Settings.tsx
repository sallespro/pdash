import { ArrowLeft, MapPin, Loader2, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { UserPreferences, Location } from '../types';
import { useState } from 'react';
import { geocodeAddress } from '../services/routing';
import { requestPermission } from '../services/notifications';

interface SettingsProps {
  prefs: UserPreferences;
  onUpdate: (updates: Partial<UserPreferences>) => void;
  onDetectLocation: () => Promise<Location | null>;
  detectingLocation: boolean;
  onBack: () => void;
  onLoadSampleData?: () => void;
}

export function Settings({ prefs, onUpdate, onDetectLocation, detectingLocation, onBack, onLoadSampleData }: SettingsProps) {
  const [addressQuery, setAddressQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!addressQuery.trim()) return;
    setSearching(true);
    const loc = await geocodeAddress(addressQuery);
    if (loc) {
      onUpdate({ home_location: { ...loc, name: 'Home' } });
    }
    setSearching(false);
  };

  const handleDetect = async () => {
    const loc = await onDetectLocation();
    if (loc) {
      onUpdate({ home_location: { ...loc, name: 'Home' } });
    }
  };

  const handleNotifications = async () => {
    const granted = await requestPermission();
    onUpdate({ notification_enabled: granted });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onBack} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {/* Home Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Home Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prefs.home_location && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-green-50 text-green-700 text-sm">
              <MapPin className="size-4 shrink-0 mt-0.5" />
              <span className="text-xs">{prefs.home_location.address}</span>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full gap-2 rounded-full"
            onClick={handleDetect}
            disabled={detectingLocation}
          >
            {detectingLocation ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MapPin className="size-4" />
            )}
            Use current location
          </Button>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Or search an address..."
              value={addressQuery}
              onChange={e => setAddressQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button size="sm" onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Window */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Scheduling Window</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Wake time</label>
              <input
                type="time"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={prefs.wake_time}
                onChange={e => onUpdate({ wake_time: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Sleep time</label>
              <input
                type="time"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={prefs.sleep_time}
                onChange={e => onUpdate({ sleep_time: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.notification_enabled}
              onChange={handleNotifications}
              className="accent-indigo-500"
            />
            Enable push notifications
          </label>
          <p className="text-xs text-gray-400 mt-1">
            Get reminders for preparation tasks and departure times
          </p>
        </CardContent>
      </Card>

      {/* Developer / Testing */}
      {onLoadSampleData && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Testing</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 rounded-full text-gray-500"
              onClick={onLoadSampleData}
            >
              <FlaskConical className="size-4" />
              Reload sample activities
            </Button>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Replaces all activities with 5 pre-built samples
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
