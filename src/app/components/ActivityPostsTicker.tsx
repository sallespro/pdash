import { useEffect, useState, useRef } from 'react';
import { Bike, Sun, Cloud, CloudRain, Thermometer, Wind, ChevronUp, ChevronDown } from 'lucide-react';

interface ActivityPost {
  id: string;
  title: string;
  body: string;
  activity: string;
  score: number;
  temperature: number;
  wind: number;
  condition: string;
  conditionCode: number;
  startTime: string;
  endTime: string;
  city: string;
  timestamp: string;
}

function conditionIcon(code: number, className = 'size-3.5') {
  if (code === 0) return <Sun className={className + ' text-amber-400'} />;
  if (code <= 3) return <Cloud className={className + ' text-slate-400'} />;
  if (code <= 69) return <CloudRain className={className + ' text-blue-400'} />;
  return <Cloud className={className + ' text-slate-300'} />;
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-orange-400';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/20';
  return 'bg-orange-500/20';
}

export function ActivityPostsTicker() {
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/activity-posts')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setPosts(data);
      })
      .catch(() => {});
  }, []);

  // Auto-rotate every 6 seconds
  useEffect(() => {
    if (posts.length <= 1) return;
    intervalRef.current = setInterval(() => {
      advance(1);
    }, 6000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [posts.length, activeIndex]);

  const advance = (dir: 1 | -1) => {
    if (transitioning || posts.length === 0) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveIndex(prev => (prev + dir + posts.length) % posts.length);
      setTransitioning(false);
    }, 200);
    // Reset auto-rotate timer
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  if (posts.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 flex items-center justify-center min-h-[180px]">
        <p className="text-slate-500 text-xs" style={{ fontFamily: "'ABC Favorit Mono', monospace" }}>
          Loading ride posts...
        </p>
      </div>
    );
  }

  const post = posts[activeIndex];

  return (
    <div
      className="bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 rounded-xl overflow-hidden relative"
      data-testid="activity-posts-ticker"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="bg-indigo-500/20 rounded-md p-1">
            <Bike className="size-3.5 text-indigo-400" />
          </div>
          <span
            className="text-[10px] uppercase tracking-widest text-slate-400"
            style={{ fontFamily: "'ABC Favorit Extended', sans-serif" }}
          >
            Best Rides
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${scoreBg(post.score)} ${scoreColor(post.score)}`}
            style={{ fontFamily: "'ABC Favorit Mono', monospace" }}>
            {post.score}
          </span>
          <div className="flex flex-col">
            <button
              onClick={() => advance(-1)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0 leading-none"
              aria-label="Previous post"
            >
              <ChevronUp className="size-3" />
            </button>
            <button
              onClick={() => advance(1)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0 leading-none"
              aria-label="Next post"
            >
              <ChevronDown className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Post content */}
      <div className={`px-3 pb-3 transition-opacity duration-200 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        {/* Title */}
        <h3
          className="text-white text-sm leading-tight mb-1.5"
          style={{ fontFamily: "'ABC Favorit Extended', sans-serif" }}
        >
          {post.title}
        </h3>

        {/* Quick stats row */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            {conditionIcon(post.conditionCode)}
            {post.condition}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <Thermometer className="size-3 text-rose-400" />
            {post.temperature}°
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <Wind className="size-3 text-sky-400" />
            {post.wind} km/h
          </span>
        </div>

        {/* Body */}
        <p
          className="text-slate-400 text-[11px] leading-relaxed line-clamp-3"
          style={{ fontFamily: "'ABC Favorit Mono', monospace" }}
        >
          {post.body}
        </p>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1 pb-2.5">
        {posts.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              setActiveIndex(i);
            }}
            className={`rounded-full transition-all duration-300 ${
              i === activeIndex
                ? 'w-4 h-1 bg-indigo-400'
                : 'w-1 h-1 bg-slate-600 hover:bg-slate-500'
            }`}
            aria-label={`Go to post ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
