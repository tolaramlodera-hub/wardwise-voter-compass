import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  // This module is imported by TanStack Start routes that are server-rendered.
  // A browser client must not be initialized (or require VITE_* browser config)
  // during SSR. Route effects and event handlers run only in the browser.
  if (typeof window === "undefined") {
    return new Proxy({} as ReturnType<typeof createBrowserClient>, {
      get() {
        throw new Error("Supabase browser client can only be used in the browser.");
      },
    });
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");
  browserClient ??= createBrowserClient(url, key);
  return browserClient;
}
