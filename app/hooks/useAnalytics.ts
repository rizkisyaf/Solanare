import { useCallback } from 'react';

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: TrackEventInit) => void;
    };
  }
}

interface TrackEventInit {
  destination?: string;
  source?: string;
  messageLength?: number;
  isTokenHolder?: boolean;
  accountsCount?: number;
  error?: string;
  id?: string;
  is_token_holder?: boolean;
  share_type?: string;
  share_method?: string;
  walletConnected?: boolean;
  previousScanResults?: number;
  bumpAmount?: number;
  personalMessage?: string;
  isHolder?: boolean;
  walletAddress?: string;
  walletName?: string;
  walletType?: string;
  page?: string;
  action?: string;
  success?: boolean;
  accountAddress?: string;
  accountName?: string;
  accountType?: string;
  amount?: number;
  signature?: string;
  wallet?: string;
}

export function useAnalytics() {
  const trackEvent = useCallback((eventName: string, data?: TrackEventInit) => {
    if (window.umami) {
      window.umami.track(eventName, data);
    }
  }, []);

  return { trackEvent };
} 