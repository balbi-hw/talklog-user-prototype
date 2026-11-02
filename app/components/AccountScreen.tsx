"use client";

import { useEffect, useRef, useState } from "react";
import type { UseAccountResult } from "../hooks/useAccount";
import {
  ACCOUNT_FAILURE_MESSAGE, DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN,
  isValidDisplayName, isValidEmail, isValidPassword, type AccountFailure,
} from "../lib/account";

type Mode = "sign-in" | "sign-up";

/** 로그인해도 기록이 옮겨지지 않는다는 사실 (FR-006, 원칙 II). */
const LOCAL_DATA_NOTICE = "로그인해도 학습방·표현·카드는 아직 이 기기에만 저장돼요. 계정으로 옮기는 기능은 준비 중이에요.";

export default function AccountScreen({ account, onBack }: { account: UseAccountResult; onBack: () => void }) {
  const { state, confirmNotice, dismissConfirmNotice } = account;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStatus = useRef(state.status);

  // 로그인·로그아웃으로 폼이나 버튼이 사라지면 포커스를 제목으로 옮긴다.
  useEffect(() => {
    if (previousStatus.current !== state.status && previousStatus.current !== "loading") headingRef.current?.focus();
    previousStatus.current = state.status;
  }, [state.status]);

  return <section className="screen account-screen">
    <button className="back" onClick={onBack} aria-label="홈으로 돌아가기">←</button>
    <h1 ref={headingRef} tabIndex={-1}>계정</h1>

    {confirmNotice && <div className={`account-banner${confirmNotice === "confirmed" ? " done" : ""}`} role="status">
      <p>{confirmNotice === "confirmed" ? "이메일 확인을 마쳤어요." : ACCOUNT_FAILURE_MESSAGE[confirmNotice]}</p>
      <button type="button" onClick={dismissConfirmNotice} aria-label="안내 닫기">닫기</button>
    </div>}

    {state.status === "loading" && <p className="account-status" role="status">계정 상태를 확인하고 있어요.</p>}

    {state.status === "unavailable" && <>
      <p className="lead">이 환경에서는 로그인을 쓸 수 없어요.</p>
      <p className="account-status">로그인 없이도 모든 기능을 이 기기에서 그대로 쓸 수 있어요.</p>
    </>}

    {state.status === "signed-out" && <AccountForm account={account} />}

    {state.status === "signed-in" && <SignedIn account={account} name={state.user.displayName} email={state.user.email} />}

    {state.status !== "unavailable" && <p className="account-local">{LOCAL_DATA_NOTICE}</p>}
  </section>;
}

function AccountForm({ account }: { account: UseAccountResult }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AccountFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const signUp = mode === "sign-up";
  const emailOk = isValidEmail(email);
  const passwordOk = isValidPassword(password);
  const nameOk = !signUp || isValidDisplayName(displayName);
  const valid = emailOk && passwordOk && nameOk;

  const switchMode = (next: Mode) => {
    setMode(next);
    setFailure(null);
    setTouched(false);
  };

  if (sentTo) return <div className="account-sent" role="status">
    <p className="lead">확인 메일을 보냈어요.</p>
    <p className="account-status"><strong>{sentTo}</strong> 로 보낸 메일의 링크를 누르면 가입이 끝나요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</p>
    <button type="button" className="account-secondary" onClick={() => { setSentTo(null); switchMode("sign-in"); }}>로그인으로 돌아가기</button>
  </div>;

  return <>
    <p className="lead">{signUp ? "이메일로 가입해요." : "이메일로 로그인해요."} 로그인하지 않아도 앱은 그대로 쓸 수 있어요.</p>
    <div className="account-modes" role="group" aria-label="로그인 또는 가입">
      <button type="button" aria-pressed={!signUp} onClick={() => switchMode("sign-in")}>로그인</button>
      <button type="button" aria-pressed={signUp} onClick={() => switchMode("sign-up")}>가입</button>
    </div>
    <form className="room-form account-form" noValidate onSubmit={async (event) => {
      event.preventDefault();
      setTouched(true);
      if (!valid || busy) return;
      setBusy(true);
      setFailure(null);
      const result = signUp
        ? await account.signUp(email, password, displayName)
        : await account.signIn(email, password);
      setBusy(false);
      if (!result.ok) { setFailure(result.reason); return; }
      setPassword("");
      if (result.outcome === "confirmation-sent") setSentTo(email.trim());
    }}>
      {signUp && <>
        <label htmlFor="account-name">표시 이름</label>
        <input id="account-name" autoComplete="nickname" value={displayName}
          aria-invalid={touched && !nameOk} aria-describedby="account-name-help"
          onChange={(event) => { setDisplayName(event.target.value); setFailure(null); }} />
        <p id="account-name-help">학습 짝에게 보일 이름이에요. 1~{DISPLAY_NAME_MAX}자로 적어 주세요.</p>
      </>}
      <label htmlFor="account-email">이메일</label>
      <input id="account-email" type="email" autoComplete="email" inputMode="email" value={email}
        aria-invalid={touched && !emailOk} aria-describedby={touched && !emailOk ? "account-email-error" : undefined}
        onChange={(event) => { setEmail(event.target.value); setFailure(null); }} />
      {touched && !emailOk && <p id="account-email-error" className="account-field-error">이메일 주소 형식을 확인해 주세요.</p>}
      <label htmlFor="account-password">비밀번호</label>
      <input id="account-password" type="password" autoComplete={signUp ? "new-password" : "current-password"}
        maxLength={PASSWORD_MAX} value={password}
        aria-invalid={touched && !passwordOk} aria-describedby="account-password-help"
        onChange={(event) => { setPassword(event.target.value); setFailure(null); }} />
      <p id="account-password-help" className={touched && !passwordOk ? "account-field-error" : undefined}>
        {PASSWORD_MIN}~{PASSWORD_MAX}자로 적어 주세요.
      </p>
      {failure && <p className="room-notice" role="alert">{ACCOUNT_FAILURE_MESSAGE[failure]}</p>}
      {busy && <p className="account-status" role="status">{signUp ? "가입하고 있어요." : "로그인하고 있어요."}</p>}
      <div className="room-actions">
        <button className="room-primary" type="submit" disabled={busy}>
          {busy ? "처리 중…" : signUp ? "가입하기" : "로그인"}
        </button>
      </div>
    </form>
  </>;
}

function SignedIn({ account, name, email }: { account: UseAccountResult; name: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AccountFailure | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (confirming) confirmRef.current?.focus(); }, [confirming]);

  const cancel = () => { setConfirming(false); setFailure(null); requestAnimationFrame(() => openRef.current?.focus()); };

  return <>
    <div className="account-card">
      <span className="account-avatar" aria-hidden="true">{name.slice(0, 1)}</span>
      <div><strong>{name}</strong><p>{email}</p></div>
    </div>
    <p className="account-status" role="status">로그인했어요.</p>
    {!confirming && <button type="button" ref={openRef} className="account-secondary" onClick={() => setConfirming(true)}>로그아웃</button>}
    {confirming && <div className="room-confirm account-confirm" role="group" aria-labelledby="account-logout-title"
      onKeyDown={(event) => { if (event.key === "Escape" && !busy) cancel(); }}>
      <p id="account-logout-title"><strong>이 기기에서 로그아웃할까요?</strong><br />이 기기에 저장된 학습방·표현·카드는 그대로 남아요.</p>
      {failure && <p className="room-notice" role="alert">{ACCOUNT_FAILURE_MESSAGE[failure]}</p>}
      {busy && <p className="account-status" role="status">로그아웃하고 있어요.</p>}
      <div className="room-actions">
        <button type="button" onClick={cancel} disabled={busy}>취소</button>
        <button type="button" ref={confirmRef} className="room-primary" disabled={busy} onClick={async () => {
          setBusy(true);
          setFailure(null);
          const result = await account.signOut();
          setBusy(false);
          if (!result.ok) setFailure(result.reason);
        }}>로그아웃</button>
      </div>
    </div>}
  </>;
}
