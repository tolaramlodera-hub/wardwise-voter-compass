import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: [Sentry.globalHandlersIntegration({ onerror: true, onunhandledrejection: true })],
    beforeSend(event) {
      // Do not forward user identity fields from this voter-management application.
      if (event.user) delete event.user;
      return event;
    },
  });
}
