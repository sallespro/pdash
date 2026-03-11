import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { Card } from "./ui/card";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  color: string;
}

export function CalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Mock events
  const events: CalendarEvent[] = [
    { id: "1", title: "Team Meeting", date: new Date(2026, 2, 12), color: "bg-blue-500" },
    { id: "2", title: "Project Deadline", date: new Date(2026, 2, 15), color: "bg-red-500" },
    { id: "3", title: "Coffee with Sarah", date: new Date(2026, 2, 10), color: "bg-green-500" },
    { id: "4", title: "Gym", date: new Date(2026, 2, 11), color: "bg-purple-500" },
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getEventsForDay = (day: number) => {
    return events.filter(event => {
      return event.date.getDate() === day &&
             event.date.getMonth() === currentDate.getMonth() &&
             event.date.getFullYear() === currentDate.getFullYear();
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() &&
           currentDate.getMonth() === today.getMonth() &&
           currentDate.getFullYear() === today.getFullYear();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
      <Card className="p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl">Calendar</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm min-w-[120px] text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('closeCalendar'))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
            <div key={day} className="text-center text-xs text-gray-500 p-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before month starts */}
          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const today = isToday(day);
            
            return (
              <div
                key={day}
                className={`aspect-square p-1 text-sm border rounded ${
                  today ? "bg-blue-50 border-blue-500" : "border-gray-200"
                }`}
              >
                <div className={`text-center ${today ? "font-bold text-blue-600" : ""}`}>
                  {day}
                </div>
                <div className="flex gap-0.5 mt-1 justify-center">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={`w-1.5 h-1.5 rounded-full ${event.color}`}
                      title={event.title}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upcoming Events */}
        <div>
          <h3 className="text-sm mb-2">Upcoming Events</h3>
          <div className="space-y-2">
            {events
              .filter(event => event.date >= new Date())
              .slice(0, 3)
              .map(event => (
                <div key={event.id} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${event.color}`} />
                  <span className="text-gray-600">
                    {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span>{event.title}</span>
                </div>
              ))}
          </div>
        </div>
      </Card>
    </div>
  );
}