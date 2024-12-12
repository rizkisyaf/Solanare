import { track as vercelTrack } from '@vercel/analytics';

export function useAnalytics() {
  const track = (eventName: string, properties?: Record<string, any>, flags?: string[]) => {
    vercelTrack(eventName, properties, { flags });
  };

  return { track };
} 