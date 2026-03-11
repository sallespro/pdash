import { useState, useCallback, useEffect } from 'react';
import { Mic, Home, Activity as ActivityIcon, Settings as SettingsIcon, Calendar } from 'lucide-react';
import { Button } from './components/ui/button';

import { Dashboard } from './components/Dashboard';
import { ActivityLibrary } from './components/ActivityLibrary';
import { ActivityEditor } from './components/ActivityEditor';
import { ScheduleProposals } from './components/ScheduleProposals';
import { ActiveSchedule } from './components/ActiveSchedule';
import { Settings } from './components/Settings';
import { VoiceOverlay } from './components/VoiceOverlay';

import { useActivities, usePlans, usePreferences, getDefaultProfile, getActivityIcon } from './store/useStore';
import { SEED_ACTIVITIES, isSeedNeeded } from './store/seedData';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useGeolocation } from './hooks/useGeolocation';

import { parseIntentAsync, inferWeatherProfile } from './services/intentParser';
import { fetchForecast, findOpportunityWindows } from './services/weather';
import { estimateCommute } from './services/routing';
import { composeSchedules } from './services/scheduleComposer';
import { scheduleReminder } from './services/notifications';

import type { Activity, ScheduledPlan, CommuteEstimate, ParsedIntent } from './types';

type Screen = 'dashboard' | 'activities' | 'editor' | 'proposals' | 'active-schedule' | 'settings';

export default function App() {
  const { activities, addActivity, updateActivity, deleteActivity, findByName } = useActivities();
  const { plans, proposedPlans, confirmedPlans, addPlans, confirmPlan, dismissProposals, updateTaskStatus, cancelPlan } = usePlans();
  const { prefs, updatePrefs } = usePreferences();
  const voice = useVoiceInput();
  const geo = useGeolocation();

  const [screen, setScreen] = useState<Screen>('dashboard');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>();
  const [draftIntent, setDraftIntent] = useState<ParsedIntent | undefined>();
  const [currentProposals, setCurrentProposals] = useState<ScheduledPlan[]>([]);
  const [proposalActivity, setProposalActivity] = useState<Activity | undefined>();
  const [proposalCommute, setProposalCommute] = useState<CommuteEstimate | null>(null);
  const [activePlan, setActivePlan] = useState<ScheduledPlan | undefined>();
  const [loadingProposals, setLoadingProposals] = useState(false);

  // Seed sample activities on first run
  useEffect(() => {
    if (isSeedNeeded()) {
      for (const a of SEED_ACTIVITIES) addActivity(a);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentDate = new Date();
  const hour = currentDate.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // --- Core flow: request an activity ---
  const requestActivity = useCallback(async (activity: Activity) => {
    const location = prefs.home_location || geo.location;
    if (!location) {
      setScreen('settings');
      return;
    }

    setProposalActivity(activity);
    setCurrentProposals([]);
    setScreen('proposals');
    setLoadingProposals(true);

    try {
      const forecast = await fetchForecast(location);
      const windows = findOpportunityWindows(
        forecast,
        activity.weather_profile,
        activity.duration_estimate
      );

      let commute: CommuteEstimate = { to_dest: 0, from_dest: 0, distance_km: 0, mode: 'cycling' };
      if (activity.default_destination) {
        commute = estimateCommute(location, activity.default_destination);
      }
      setProposalCommute(commute);

      const schedules = composeSchedules(
        activity,
        windows,
        commute,
        prefs.wake_time,
        prefs.sleep_time
      );

      // Clear any stale proposals for this activity before adding new ones
      dismissProposals(activity.id);
      setCurrentProposals(schedules);
      addPlans(schedules);
    } catch (err) {
      console.error('Failed to generate proposals:', err);
    }
    setLoadingProposals(false);
  }, [prefs, geo.location, addPlans]);

  // --- Select a proposed schedule ---
  const selectProposal = useCallback((plan: ScheduledPlan) => {
    confirmPlan(plan.id);
    // Dismiss other proposals for this activity
    dismissProposals(plan.activity_id);

    // Schedule reminders
    if (prefs.notification_enabled) {
      for (const task of plan.scheduled_tasks) {
        const reminderTime = new Date(new Date(task.start_time).getTime() - 15 * 60 * 1000);
        scheduleReminder(
          `${task.name} starting soon`,
          `Starting at ${new Date(task.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          reminderTime
        );
      }
    }

    setActivePlan({ ...plan, status: 'confirmed' });
    setScreen('active-schedule');
  }, [confirmPlan, dismissProposals, prefs.notification_enabled]);

  // --- Voice input processing ---
  const processVoiceInput = useCallback(async (text: string) => {
    setVoiceOpen(false);
    voice.reset();

    const intent = await parseIntentAsync(text);

    if (intent.type === 'activity_request' && intent.activity_name) {
      const existing = findByName(intent.activity_name);
      if (existing) {
        requestActivity(existing);
        return;
      }
      // Activity not found — switch to definition mode
      setDraftIntent(intent);
      setEditingActivity(undefined);
      setScreen('editor');
      return;
    }

    if (intent.type === 'activity_definition') {
      setDraftIntent(intent);
      setEditingActivity(undefined);
      setScreen('editor');
      return;
    }

    // general_query — for now just go to dashboard
    setScreen('dashboard');
  }, [findByName, requestActivity, voice]);

  // --- Save activity from editor ---
  const handleSaveActivity = useCallback((data: any) => {
    if (data.id) {
      updateActivity(data.id, data);
    } else {
      const created = addActivity(data);
      // If this came from a request intent, immediately find schedules
      if (draftIntent?.type === 'activity_request') {
        requestActivity({ ...data, id: created.id } as Activity);
        setDraftIntent(undefined);
        return;
      }
    }
    setDraftIntent(undefined);
    setEditingActivity(undefined);
    setScreen('activities');
  }, [addActivity, updateActivity, draftIntent, requestActivity]);

  // --- Render current screen ---
  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':
        return (
          <Dashboard
            location={prefs.home_location || geo.location}
            confirmedPlans={confirmedPlans}
            activities={activities}
            onSelectPlan={(plan) => {
              setActivePlan(plan);
              setScreen('active-schedule');
            }}
          />
        );

      case 'activities':
        return (
          <ActivityLibrary
            activities={activities}
            onSelect={(a) => requestActivity(a)}
            onEdit={(a) => { setEditingActivity(a); setDraftIntent(undefined); setScreen('editor'); }}
            onDelete={deleteActivity}
            onNew={() => { setEditingActivity(undefined); setDraftIntent(undefined); setScreen('editor'); }}
          />
        );

      case 'editor':
        return (
          <ActivityEditor
            activity={editingActivity}
            onSave={handleSaveActivity}
            onCancel={() => {
              setEditingActivity(undefined);
              setDraftIntent(undefined);
              setScreen('activities');
            }}
            initialName={draftIntent?.activity_name}
            initialTasks={draftIntent?.task_hints}
            initialWeatherHints={draftIntent?.weather_hints}
            initialDuration={draftIntent?.duration_hint}
            rawDescription={draftIntent?.raw_text}
          />
        );

      case 'proposals':
        return proposalActivity ? (
          <ScheduleProposals
            proposals={currentProposals}
            activity={proposalActivity}
            commute={proposalCommute}
            onSelect={selectProposal}
            onDismiss={() => setScreen('dashboard')}
            loading={loadingProposals}
          />
        ) : null;

      case 'active-schedule':
        return activePlan ? (
          <ActiveSchedule
            plan={activePlan}
            activity={activities.find(a => a.id === activePlan.activity_id)}
            onUpdateTask={(taskId, status) => {
              updateTaskStatus(activePlan.id, taskId, status);
              setActivePlan(prev => prev ? {
                ...prev,
                scheduled_tasks: prev.scheduled_tasks.map(t =>
                  t.id === taskId ? { ...t, status } : t
                ),
              } : undefined);
            }}
            onCancel={() => {
              cancelPlan(activePlan.id);
              setScreen('dashboard');
            }}
            onBack={() => setScreen('dashboard')}
          />
        ) : null;

      case 'settings':
        return (
          <Settings
            prefs={prefs}
            onUpdate={updatePrefs}
            onDetectLocation={geo.requestLocation}
            detectingLocation={geo.loading}
            onBack={() => setScreen('dashboard')}
            onLoadSampleData={() => {
              // Clear and reseed activities
              for (const a of activities) deleteActivity(a.id);
              setTimeout(() => {
                for (const a of SEED_ACTIVITIES) addActivity(a);
              }, 50);
            }}
          />
        );
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-light">{greeting}!</h1>
          <p className="text-xs text-gray-500">
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <div className="max-w-lg mx-auto">
          {renderScreen()}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl border-t">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          <NavButton
            icon={<Home className="size-5" />}
            label="Home"
            active={screen === 'dashboard'}
            onClick={() => setScreen('dashboard')}
          />
          <NavButton
            icon={<ActivityIcon className="size-5" />}
            label="Activities"
            active={screen === 'activities' || screen === 'editor'}
            onClick={() => setScreen('activities')}
          />

          {/* Center mic button */}
          <div className="-mt-5">
            <Button
              size="icon"
              className="size-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { setVoiceOpen(true); }}
            >
              <Mic className="size-6" />
            </Button>
          </div>

          <NavButton
            icon={<Calendar className="size-5" />}
            label="Schedules"
            active={screen === 'active-schedule' || screen === 'proposals'}
            badge={confirmedPlans.length > 0 ? confirmedPlans.length : undefined}
            onClick={() => {
              if (confirmedPlans.length > 0) {
                setActivePlan(confirmedPlans[0]);
                setScreen('active-schedule');
              }
            }}
          />
          <NavButton
            icon={<SettingsIcon className="size-5" />}
            label="Settings"
            active={screen === 'settings'}
            onClick={() => setScreen('settings')}
          />
        </div>
      </div>

      {/* Voice Overlay */}
      <VoiceOverlay
        open={voiceOpen}
        listening={voice.listening}
        transcript={voice.transcript}
        interimTranscript={voice.interimTranscript}
        supported={voice.supported}
        error={voice.error}
        onStart={voice.start}
        onStop={voice.stop}
        onSubmit={processVoiceInput}
        onClose={() => { voice.stop(); setVoiceOpen(false); }}
      />
    </div>
  );
}

function NavButton({
  icon, label, active, badge, onClick,
}: {
  icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-0.5 px-3 py-1 relative ${
        active ? 'text-indigo-600' : 'text-gray-400'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
      {badge !== undefined && (
        <span className="absolute -top-0.5 right-1 size-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
