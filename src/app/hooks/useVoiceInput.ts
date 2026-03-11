import { useState, useCallback, useRef } from 'react';
import { createRecognition, isSupported } from '../services/speechToText';
import type { SpeechStatus } from '../types';

export function useVoiceInput() {
  const [status, setStatus] = useState<SpeechStatus>({
    listening: false,
    transcript: '',
    interimTranscript: '',
    supported: isSupported(),
    error: null,
  });

  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const transcriptRef = useRef('');

  const start = useCallback(() => {
    transcriptRef.current = '';
    setStatus(prev => ({ ...prev, transcript: '', interimTranscript: '', error: null }));

    const rec = createRecognition(
      (text, isFinal) => {
        if (isFinal) {
          transcriptRef.current += (transcriptRef.current ? ' ' : '') + text;
          setStatus(prev => ({
            ...prev,
            transcript: transcriptRef.current,
            interimTranscript: '',
          }));
        } else {
          setStatus(prev => ({ ...prev, interimTranscript: text }));
        }
      },
      ({ listening, error }) => {
        setStatus(prev => ({ ...prev, listening, error }));
      }
    );

    recognitionRef.current = rec;
    rec.start();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    transcriptRef.current = '';
    setStatus(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
    }));
  }, []);

  return { ...status, start, stop, reset };
}
