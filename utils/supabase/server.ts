import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { CONFIRM_TIMEOUT_MS, timedFetch } from "./timeout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** 키가 없는 환경에서는 null 이다. */
export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseKey) return null;
  return createServerClient(supabaseUrl, supabaseKey, {
    global: { fetch: timedFetch(CONFIRM_TIMEOUT_MS) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};
