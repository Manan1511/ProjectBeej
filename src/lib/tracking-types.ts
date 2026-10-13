export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
};

export type StoredConsent = {
  preferences: ConsentPreferences;
  updatedAt: string;
  expiresAt: number;
};

export type GoogleAnalyticsIdentifiers = {
  clientId?: string;
  sessionId?: string;
};

export type TrackingIdentifiers = GoogleAnalyticsIdentifiers & {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  fbp?: string;
  fbc?: string;
};
