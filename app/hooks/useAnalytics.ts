import { useCallback } from 'react';

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, any>) => void;
    };
  }
}

export function useAnalytics() {
  const trackEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    if (window.umami) {
      window.umami.track(eventName, data);
    }
  }, []);

  return { trackEvent };
} 