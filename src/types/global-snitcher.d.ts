type SnitcherMethod =
  | "track"
  | "page"
  | "identify"
  | "group"
  | "alias"
  | "ready"
  | "debug"
  | "on"
  | "off"
  | "once"
  | "trackClick"
  | "trackSubmit"
  | "trackLink"
  | "trackForm"
  | "pageview"
  | "screen"
  | "reset"
  | "register"
  | "setAnonymousId"
  | "addSourceMiddleware"
  | "addIntegrationMiddleware"
  | "addDestinationMiddleware"
  | "giveCookieConsent";

type SnitcherQueueCall = [SnitcherMethod, ...unknown[]];

interface SnitcherApi extends Array<SnitcherQueueCall> {
  initialized?: boolean;
  _loaded?: boolean;
  bootstrap?: () => void;
  track: (...args: unknown[]) => unknown;
  page: (...args: unknown[]) => unknown;
  identify: (...args: unknown[]) => unknown;
  group: (...args: unknown[]) => unknown;
  alias: (...args: unknown[]) => unknown;
  ready: (...args: unknown[]) => unknown;
  debug: (...args: unknown[]) => unknown;
  on: (...args: unknown[]) => unknown;
  off: (...args: unknown[]) => unknown;
  once: (...args: unknown[]) => unknown;
  trackClick: (...args: unknown[]) => unknown;
  trackSubmit: (...args: unknown[]) => unknown;
  trackLink: (...args: unknown[]) => unknown;
  trackForm: (...args: unknown[]) => unknown;
  pageview: (...args: unknown[]) => unknown;
  screen: (...args: unknown[]) => unknown;
  reset: (...args: unknown[]) => unknown;
  register: (...args: unknown[]) => unknown;
  setAnonymousId: (...args: unknown[]) => unknown;
  addSourceMiddleware: (...args: unknown[]) => unknown;
  addIntegrationMiddleware: (...args: unknown[]) => unknown;
  addDestinationMiddleware: (...args: unknown[]) => unknown;
  giveCookieConsent: (...args: unknown[]) => unknown;
}

declare global {
  interface Window {
    Snitcher?: SnitcherApi;
  }
}

export {};
