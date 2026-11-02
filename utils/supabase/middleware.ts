import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { MIDDLEWARE_TIMEOUT_MS, timedFetch, withDeadline } from "./timeout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  // 키가 없는 환경(로컬 프로토타입, CI)에서는 세션 갱신을 건너뛴다.
  if (!supabaseUrl || !supabaseKey) return supabaseResponse;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    global: { fetch: timedFetch(MIDDLEWARE_TIMEOUT_MS) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // getClaims()가 토큰을 검증하고, 만료됐으면 갱신해 쿠키에 기록한다.
  // Supabase에 닿지 못해도 페이지는 로그인 없이 열려야 하므로 실패를 삼킨다 (009 FR-007).
  // 갱신은 실패하면 스스로 재시도하므로 호출 전체에도 상한을 둔다. 넘으면 갱신 없이 지나간다.
  try {
    await withDeadline(supabase.auth.getClaims(), MIDDLEWARE_TIMEOUT_MS);
  } catch {
    // 세션 갱신 실패는 로그아웃 상태와 같게 다룬다.
  }

  return supabaseResponse;
};
