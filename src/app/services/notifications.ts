export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notify(title: string, body: string, icon?: string) {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: icon || '/favicon.ico' });
}

export function scheduleReminder(title: string, body: string, atTime: Date) {
  const delay = atTime.getTime() - Date.now();
  if (delay <= 0) return;
  setTimeout(() => notify(title, body), delay);
}
