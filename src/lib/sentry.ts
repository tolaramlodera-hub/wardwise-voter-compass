import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
let browserSentryInitialized = false;

/**
 * Initialize the browser SDK only in the browser. TanStack Start evaluates
 * shared route modules during SSR as well, so the server render must not be
 * mistaken for a browser SDK initialization.
 */
export function initializeBrowserSentry(): boolean {
  if (typeof window === "undefined" || !dsn) return false;
  if (browserSentryInitialized) return true;

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      integrations: [Sentry.globalHandlersIntegration({ onerror: true, onunhandledrejection: true })],
      beforeSend(event) {
        if (event.user) delete event.user;
        return event;
      },
    });
    browserSentryInitialized = true;
    return true;
  } catch (error) {
    console.error("Sentry browser initialization failed", error);
    return false;
  }
}

export function isBrowserSentryInitialized(): boolean {
  return browserSentryInitialized;
}

// This is a no-op during SSR and initializes the SDK during browser startup.
initializeBrowserSentry();
