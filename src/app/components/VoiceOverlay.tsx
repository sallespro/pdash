import { useEffect, useRef } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { Button } from './ui/button';

interface VoiceOverlayProps {
  listening: boolean;
  transcript: string;
  interimTranscript: string;
  supported: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onSubmit: (text: string) => void;
  onClose: () => void;
  open: boolean;
}

export function VoiceOverlay({
  listening, transcript, interimTranscript, supported, error,
  onStart, onStop, onSubmit, onClose, open,
}: VoiceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Simple waveform animation when listening
  useEffect(() => {
    if (!listening || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let t = 0;

    const draw = () => {
      t += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const y = canvas.height / 2 +
          Math.sin(x * 0.03 + t) * 12 +
          Math.sin(x * 0.05 + t * 1.3) * 8 +
          Math.sin(x * 0.07 + t * 0.7) * 6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [listening]);

  if (!open) return null;

  const fullText = (transcript + ' ' + interimTranscript).trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-sm font-medium text-gray-500">
            {listening ? 'Listening...' : 'Tap mic to speak'}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="size-5" />
          </button>
        </div>

        {/* Waveform */}
        <div className="px-5 h-12">
          {listening ? (
            <canvas ref={canvasRef} width={480} height={48} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="h-[2px] w-full bg-gray-200 rounded" />
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="px-5 py-3 min-h-[80px] max-h-[160px] overflow-y-auto">
          {fullText ? (
            <p className="text-gray-800">
              {transcript}
              {interimTranscript && (
                <span className="text-gray-400"> {interimTranscript}</span>
              )}
            </p>
          ) : (
            <p className="text-gray-400 text-sm italic">
              {supported
                ? 'Say something like "I want to ride my bike" or "I like to surf when it\'s windy"'
                : 'Speech recognition is not supported in this browser'}
            </p>
          )}
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 px-5 pb-5 pt-2">
          <Button
            size="icon"
            variant={listening ? 'destructive' : 'default'}
            className="size-14 rounded-full"
            onClick={listening ? onStop : onStart}
            disabled={!supported}
          >
            {listening ? <MicOff className="size-6" /> : <Mic className="size-6" />}
          </Button>
          {fullText && !listening && (
            <Button onClick={() => onSubmit(fullText)} className="rounded-full px-6">
              Process
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
