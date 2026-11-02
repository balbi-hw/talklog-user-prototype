import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  // 키가 없는 환경(로컬 프로토타입, CI)에서는 세션 갱신을 건너뛴다.
  if (!supabaseUrl || !supabaseKey) return supabaseResponse;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
  try {
    await supabase.auth.getClaims();
  } catch {
    // 세션 갱신 실패는 로그아웃 상태와 같게 다룬다.
  }

  return supabaseResponse;
};
