// Browser Speech-to-Text using Web Speech API
// Reference: adapted from webtalk/speech.js patterns for browser context

type SpeechCallback = (transcript: string, isFinal: boolean) => void;
type StatusCallback = (status: { listening: boolean; error: string | null }) => void;

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function isSupported(): boolean {
  return !!SpeechRecognition;
}

export function createRecognition(
  onTranscript: SpeechCallback,
  onStatus: StatusCallback,
  lang = 'en-US'
): { start: () => void; stop: () => void; abort: () => void } {
  if (!SpeechRecognition) {
    return {
      start: () => onStatus({ listening: false, error: 'Speech recognition not supported' }),
      stop: () => {},
      abort: () => {},
    };
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;

  recognition.onstart = () => {
    onStatus({ listening: true, error: null });
  };

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    if (final) onTranscript(final, true);
    if (interim) onTranscript(interim, false);
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech') return; // expected during silence
    onStatus({ listening: false, error: event.error });
  };

  recognition.onend = () => {
    onStatus({ listening: false, error: null });
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        // already started
      }
    },
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}

// Split sentences for processing (from webtalk reference)
export function splitSentences(text: string): string[] {
  return text.match(/(?:[^.!?]|[.!?](?!\s))+[.!?]*(?:\s+|$)/g)?.map(s => s.trim()).filter(Boolean) || [text];
}
