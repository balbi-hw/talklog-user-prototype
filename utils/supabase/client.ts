import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let browserClient: SupabaseClient | null = null;

/** 키가 없는 환경(로컬 프로토타입, CI)에서는 null 이다. 호출하는 쪽은 로그인 없이 동작해야 한다. */
export const createClient = (): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseKey) return null;
  browserClient ??= createBrowserClient(supabaseUrl, supabaseKey);
  return browserClient;
};
