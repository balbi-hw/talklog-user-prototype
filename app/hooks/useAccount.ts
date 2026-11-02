"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  accountFailure, toAccountUser, withTimeout,
  type AccountFailure, type AccountResult, type AccountState,
} from "../lib/account";

/** 확인 링크에서 돌아왔을 때 한 번 보여 줄 안내 (contracts/use-account.md). */
export type ConfirmNotice = "confirmed" | AccountFailure | null;

export type UseAccountResult = {
  state: AccountState;
  confirmNotice: ConfirmNotice;
  dismissConfirmNotice: () => void;
  signIn: (email: string, password: string) => Promise<AccountResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<AccountResult>;
  signOut: () => Promise<AccountResult>;
};

/** 주소의 `account`·`code` 질의값을 읽고 지운다. 새로고침해도 안내가 다시 뜨지 않게 한다. */
function clearReturnParams() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("account") && !url.searchParams.has("code")) return;
  url.searchParams.delete("account");
  url.searchParams.delete("code");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export function useAccount(): UseAccountResult {
  // 첫 렌더는 서버와 같게 loading 이다. 세션 읽기는 effect 안에서 한다.
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const [confirmNotice, setConfirmNotice] = useState<ConfirmNotice>(null);

  useEffect(() => {
    const account = new URL(window.location.href).searchParams.get("account");
    if (account === "confirmed") setConfirmNotice("confirmed");
    else if (account === "confirm-failed") setConfirmNotice("confirm-failed");
    const supabase = createClient();
    if (!supabase) {
      // 키가 없는 빌드도 확인 링크 결과(/auth/confirm 이 confirm-failed 로 보냄)는 알리고 주소를 정리한다.
      setState({ status: "unavailable" });
      clearReturnParams();
      return;
    }
    // 리디렉션 주소가 허용 목록에 없으면 Supabase 는 Site URL(`/?code=`)로 돌려보낸다.
    // 브라우저 클라이언트가 그 code 를 스스로 교환하므로, 첫 세션 결과로 성공 여부만 알린다.
    const returnedWithCode = new URL(window.location.href).searchParams.has("code");

    // 화면 표시용이다. 권한 판단은 서버(getClaims)와 이후 RLS 가 맡는다.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState(session?.user ? { status: "signed-in", user: toAccountUser(session.user) } : { status: "signed-out" });
      if (event === "INITIAL_SESSION") {
        if (returnedWithCode) setConfirmNotice(session ? "confirmed" : "confirm-failed");
        clearReturnParams();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AccountResult> => {
    const supabase = createClient();
    if (!supabase) return { ok: false, reason: "unknown" };
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
      return error ? { ok: false, reason: accountFailure(error) } : { ok: true, outcome: "signed-in" };
    } catch (error) {
      return { ok: false, reason: accountFailure(error) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string): Promise<AccountResult> => {
    const supabase = createClient();
    if (!supabase) return { ok: false, reason: "unknown" };
    try {
      const { data, error } = await withTimeout(supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      }));
      if (error) return { ok: false, reason: accountFailure(error) };
      // 이메일 확인이 켜져 있으면 이미 가입된 이메일에도 오류 대신 identities 가 빈 사용자를 돌려준다.
      if (data.user && data.user.identities?.length === 0) return { ok: false, reason: "email-exists" };
      return { ok: true, outcome: data.session ? "signed-in" : "confirmation-sent" };
    } catch (error) {
      return { ok: false, reason: accountFailure(error) };
    }
  }, []);

  const signOut = useCallback(async (): Promise<AccountResult> => {
    const supabase = createClient();
    if (!supabase) return { ok: false, reason: "unknown" };
    try {
      // 이 기기의 세션만 끝낸다. 서버에 닿지 못해도 로컬 세션은 지워진다.
      const { error } = await withTimeout(supabase.auth.signOut({ scope: "local" }));
      if (error) return { ok: false, reason: accountFailure(error) };
      return { ok: true, outcome: "signed-out" };
    } catch (error) {
      return { ok: false, reason: accountFailure(error) };
    }
  }, []);

  const dismissConfirmNotice = useCallback(() => setConfirmNotice(null), []);

  return { state, confirmNotice, dismissConfirmNotice, signIn, signUp, signOut };
}
