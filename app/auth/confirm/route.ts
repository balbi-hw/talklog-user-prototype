import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "email", "invite", "magiclink", "recovery", "email_change"];

/**
 * 가입 확인 메일의 링크가 돌아오는 곳 (specs/009-auth/contracts/auth-confirm.md).
 * PKCE `code` 와 메일 템플릿의 `token_hash` 둘 다 받는다. 결과는 홈의 `account` 질의값으로 알린다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const done = (result: "confirmed" | "confirm-failed") => NextResponse.redirect(new URL(`/?account=${result}`, origin));

  const supabase = createClient(await cookies());
  if (!supabase) return done("confirm-failed");

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return done(error ? "confirm-failed" : "confirmed");
    }
    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      return done(error ? "confirm-failed" : "confirmed");
    }
  } catch {
    // 네트워크 실패도 확인 실패로 알린다.
  }
  return done("confirm-failed");
}
