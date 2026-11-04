import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");
  browserClient ??= createBrowserClient(url, key);
  return browserClient;
}
