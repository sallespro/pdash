import { Bike } from 'lucide-react';
import type { ActivityPost } from './ActivityPostsTicker';

const DAY_START_H = 6;   // 6am
const DAY_END_H = 22;    // 10pm
const DAY_HOURS = DAY_END_H - DAY_START_H;
const TICK_HOURS = [8, 10, 12, 14, 16, 18, 20];

interface ActivityCalendarProps {
  posts: ActivityPost[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

function scoreToColor(score: number, active: boolean) {
  if (active) return { bg: 'bg-indigo-500/80 border-indigo-400/60', icon: 'text-white' };
  if (score >= 75) return { bg: 'bg-emerald-500/50 hover:bg-emerald-500/70 border-emerald-400/30', icon: 'text-emerald-200' };
  if (score >= 60) return { bg: 'bg-amber-500/40 hover:bg-amber-500/60 border-amber-400/30', icon: 'text-amber-200' };
  return { bg: 'bg-orange-500/40 hover:bg-orange-500/60 border-orange-400/30', icon: 'text-orange-200' };
}

export function ActivityCalendar({ posts, activeIndex, onSelect }: ActivityCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [0, 1, 2].map(offset => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d;
  });

  const TIMELINE_H = 144; // px height of timeline area

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="bg-indigo-500/20 rounded-md p-1">
          <Bike className="size-3.5 text-indigo-400" />
        </div>
        <span
          className="text-[10px] uppercase tracking-widest text-slate-400"
          style={{ fontFamily: "'ABC Favorit Extended', sans-serif" }}
        >
          Ride Windows
        </span>
        {posts.length > 0 && (
          <span
            className="ml-auto text-[9px] text-slate-500"
            style={{ fontFamily: "'ABC Favorit Mono', monospace" }}
          >
            {posts.length} window{posts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* 3-day grid */}
      <div className="grid grid-cols-3 gap-2">
        {days.map((day, dayIdx) => {
          const dayLabel =
            dayIdx === 0 ? 'Today' :
            dayIdx === 1 ? 'Tmrw' :
            day.toLocaleDateString('en-US', { weekday: 'short' });

          const dayDate = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          // Posts that fall on this day
          const dayPosts = posts
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => {
              const s = new Date(p.startTime);
              const sDay = new Date(s); sDay.setHours(0, 0, 0, 0);
              return sDay.getTime() === day.getTime();
            });

          return (
            <div key={dayIdx} className="flex flex-col gap-1">
              {/* Day label */}
              <div className="text-center">
                <div className="text-[10px] font-medium text-slate-300">{dayLabel}</div>
                <div className="text-[9px] text-slate-600">{dayDate}</div>
              </div>

              {/* Timeline */}
              <div
                className="relative bg-slate-700/20 rounded-lg border border-slate-700/30 overflow-hidden"
                style={{ height: `${TIMELINE_H}px` }}
              >
                {/* Hour tick marks */}
                {TICK_HOURS.map(h => {
                  const pct = (h - DAY_START_H) / DAY_HOURS * 100;
                  return (
                    <div
                      key={h}
                      className="absolute w-full"
                      style={{ top: `${pct}%` }}
                    >
                      <div className="border-t border-slate-700/40 w-full" />
                      <span className="absolute top-0 left-0.5 text-[7px] text-slate-600 leading-none">
                        {h}
                      </span>
                    </div>
                  );
                })}

                {/* Current time indicator (today only) */}
                {dayIdx === 0 && (() => {
                  const now = new Date();
                  const currentH = now.getHours() + now.getMinutes() / 60;
                  if (currentH >= DAY_START_H && currentH <= DAY_END_H) {
                    const pct = (currentH - DAY_START_H) / DAY_HOURS * 100;
                    return (
                      <div
                        className="absolute w-full z-10"
                        style={{ top: `${pct}%` }}
                      >
                        <div className="border-t border-indigo-400/60 w-full" />
                        <div className="absolute -top-1 left-0 size-2 rounded-full bg-indigo-400" />
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Window blocks */}
                {dayPosts.map(({ p, i }) => {
                  const start = new Date(p.startTime);
                  const end = new Date(p.endTime);
                  const startH = start.getHours() + start.getMinutes() / 60;
                  const endH = end.getHours() + end.getMinutes() / 60;
                  const topPct = Math.max(0, (startH - DAY_START_H) / DAY_HOURS * 100);
                  const heightPct = Math.min(100 - topPct, (endH - startH) / DAY_HOURS * 100);
                  const isActive = i === activeIndex;
                  const { bg, icon } = scoreToColor(p.score, isActive);

                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelect(i)}
                      className={`absolute left-1 right-1 rounded border flex items-center justify-center transition-all duration-200 ${bg}`}
                      style={{
                        top: `${topPct}%`,
                        height: `${Math.max(heightPct, 8)}%`,
                        minHeight: '14px',
                      }}
                      title={`${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · Score ${p.score}`}
                    >
                      {isActive ? (
                        <Bike className={`size-2.5 ${icon} drop-shadow`} />
                      ) : (
                        <span className={`text-[7px] font-medium ${icon}`}>{p.score}</span>
                      )}
                    </button>
                  );
                })}

                {/* No windows indicator */}
                {dayPosts.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[8px] text-slate-700">—</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 justify-end">
        <span className="flex items-center gap-1 text-[8px] text-slate-600">
          <span className="w-2 h-2 rounded-sm bg-emerald-500/50 border border-emerald-400/30 inline-block" />
          Good
        </span>
        <span className="flex items-center gap-1 text-[8px] text-slate-600">
          <span className="w-2 h-2 rounded-sm bg-amber-500/40 border border-amber-400/30 inline-block" />
          Fair
        </span>
        <span className="flex items-center gap-1 text-[8px] text-slate-600">
          <span className="w-2 h-2 rounded-sm bg-indigo-500/80 border border-indigo-400/60 inline-block" />
          Active
        </span>
      </div>
    </div>
  );
}
