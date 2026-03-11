import { Calendar as CalendarIcon } from "lucide-react";
import { Card } from "./ui/card";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
  color: string;
}

interface UpcomingEventsProps {
  onShowCalendar: () => void;
}

export function UpcomingEvents({ onShowCalendar }: UpcomingEventsProps) {
  // Mock events
  const events: CalendarEvent[] = [
    { id: "1", title: "Team Meeting", date: new Date(2026, 2, 12, 10, 0), time: "10:00 AM", color: "bg-blue-500" },
    { id: "2", title: "Project Deadline", date: new Date(2026, 2, 15, 17, 0), time: "5:00 PM", color: "bg-red-500" },
    { id: "3", title: "Coffee with Sarah", date: new Date(2026, 2, 10, 14, 30), time: "2:30 PM", color: "bg-green-500" },
    { id: "4", title: "Gym", date: new Date(2026, 2, 11, 18, 0), time: "6:00 PM", color: "bg-purple-500" },
    { id: "5", title: "Dentist Appointment", date: new Date(2026, 2, 13, 9, 0), time: "9:00 AM", color: "bg-orange-500" },
    { id: "6", title: "Lunch with Client", date: new Date(2026, 2, 14, 12, 30), time: "12:30 PM", color: "bg-pink-500" },
  ];

  const today = new Date();
  const upcomingEvents = events
    .filter(event => event.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const formatDate = (date: Date) => {
    const dayDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Tomorrow";
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg">Upcoming Events</h2>
        <button
          onClick={onShowCalendar}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Show full calendar"
        >
          <CalendarIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1">
        {upcomingEvents.map(event => (
          <div key={event.id} className="flex gap-3 p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
            <div className={`w-1 rounded-full ${event.color} flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm mb-1 truncate">{event.title}</div>
              <div className="text-xs text-gray-500">
                {formatDate(event.date)} · {event.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
