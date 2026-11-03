"use client";

import { useEffect, useRef, useState } from "react";
import type { UseAccountResult } from "../hooks/useAccount";
import type { UseRecordSyncResult } from "../hooks/useRecordSync";
import { syncMessage } from "./RecordSyncNotice";
import {
  ACCOUNT_FAILURE_MESSAGE, DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN,
  isValidDisplayName, isValidEmail, isValidPassword, type AccountFailure,
} from "../lib/account";

type Mode = "sign-in" | "sign-up";

/** 기록이 어디에 저장되는지 (010 FR-001·FR-002, 원칙 II). 011 부터 로그인한 동안 보낸 음성 메시지도 계정에 저장된다 (FR-015). */
const SIGNED_OUT_NOTICE = "로그인하지 않으면 학습방·표현·카드·복습 기록은 이 기기에만 저장돼요.";
const SIGNED_IN_NOTICE = "로그인한 동안 학습방·표현·카드·복습 기록과 학습 짝과 주고받은 음성 메시지는 계정에 저장돼요.";

export default function AccountScreen({ account, sync, unsentMessages = 0, onBack }: {
  account: UseAccountResult; sync: UseRecordSyncResult;
  /** 011: 보내는 중이거나 보내지 못한 음성 메시지 수. 로그아웃하면 사라진다 (D8). */
  unsentMessages?: number;
  onBack: () => void;
}) {
  const { state, confirmNotice, dismissConfirmNotice } = account;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStatus = useRef(state.status);
  /** 누른 버튼이 사라지는 화면 전환에서 포커스를 제목으로 옮긴다 (FR-011). 제목은 늘 화면에 있다. */
  const focusHeading = () => headingRef.current?.focus();

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
      <button type="button" onClick={() => { dismissConfirmNotice(); focusHeading(); }} aria-label="안내 닫기">닫기</button>
    </div>}

    {state.status === "loading" && <p className="account-status" role="status">계정 상태를 확인하고 있어요.</p>}

    {state.status === "unavailable" && <>
      <p className="lead">이 환경에서는 로그인을 쓸 수 없어요.</p>
      <p className="account-status">로그인 없이도 모든 기능을 이 기기에서 그대로 쓸 수 있어요.</p>
    </>}

    {state.status === "signed-out" && <AccountForm account={account} onViewChange={focusHeading} />}

    {state.status === "signed-in" && <SignedIn account={account} sync={sync} unsentMessages={unsentMessages} userId={state.user.id} name={state.user.displayName} email={state.user.email} />}

    {state.status === "signed-out" && <p className="account-local">{SIGNED_OUT_NOTICE}</p>}
    {state.status === "signed-in" && <p className="account-local">{SIGNED_IN_NOTICE}</p>}
  </section>;
}

function AccountForm({ account, onViewChange }: { account: UseAccountResult; onViewChange: () => void }) {
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
    <button type="button" className="account-secondary" onClick={() => { setSentTo(null); switchMode("sign-in"); onViewChange(); }}>로그인으로 돌아가기</button>
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
      if (result.outcome === "confirmation-sent") { setSentTo(email.trim()); onViewChange(); }
    }}>
      {signUp && <>
        <label htmlFor="account-name">표시 이름</label>
        <input id="account-name" autoComplete="nickname" value={displayName}
          aria-invalid={touched && !nameOk}
          aria-describedby={touched && !nameOk ? "account-name-error account-name-help" : "account-name-help"}
          onChange={(event) => { setDisplayName(event.target.value); setFailure(null); }} />
        {touched && !nameOk && <p id="account-name-error" className="account-field-error">표시 이름을 확인해 주세요.</p>}
        <p id="account-name-help" className={touched && !nameOk ? "account-field-error" : undefined}>
          학습 짝에게 보일 이름이에요. 1~{DISPLAY_NAME_MAX}자로 적어 주세요.
        </p>
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

function SignedIn({ account, sync, unsentMessages, userId, name, email }: {
  account: UseAccountResult; sync: UseRecordSyncResult; unsentMessages: number; userId: string; name: string; email: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const message = syncMessage(sync);
  const deviceCount = sync.device.rooms + sync.device.expressions;
  const pending = confirming ? sync.pendingFor(userId) : 0;
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
    {message && <div className={`account-sync ${message.tone}`}>
      <p role="status">{message.text}</p>
      {message.retry && <button type="button" className="account-secondary" onClick={sync.retry}>다시 시도</button>}
    </div>}
    {deviceCount > 0 && <div className="account-import">
      <p>이 기기에 로그인 전 기록이 있어요 (학습방 {sync.device.rooms}개, 표현 {sync.device.expressions}개).</p>
      <button type="button" className="account-secondary" onClick={() => {
        const result = sync.importNow();
        setImportNotice(result.ok
          ? `학습방 ${result.rooms}개, 표현 ${result.expressions}개를 가져왔어요.${result.skipped ? ` 이미 있던 ${result.skipped}개는 건너뛰었어요.` : ""}`
          : result.reason === "not-ready" ? "계정 기록을 아직 받아 오지 못했어요. 잠시 뒤 다시 시도해 주세요." : "기록을 읽거나 쓰지 못했어요.");
      }}>계정으로 가져오기</button>
      {importNotice && <p className="account-status" role="status">{importNotice}</p>}
    </div>}
    {!confirming && <button type="button" ref={openRef} className="account-secondary" onClick={() => setConfirming(true)}>로그아웃</button>}
    {confirming && <div className="room-confirm account-confirm" role="group" aria-labelledby="account-logout-title"
      onKeyDown={(event) => { if (event.key === "Escape" && !busy) cancel(); }}>
      <p id="account-logout-title"><strong>이 기기에서 로그아웃할까요?</strong><br />계정 기록은 계정에 남고, 다시 로그인하면 받아 와요. 로그인 전에 이 기기에 저장한 기록도 그대로 남아요.</p>
      {pending > 0 && <p className="room-notice">아직 계정에 보내지 못한 변경이 {pending}건 있어요. 지금 로그아웃하면 이 변경은 사라져요.</p>}
      {unsentMessages > 0 && <p className="room-notice">보내는 중이거나 보내지 못한 음성 메시지가 {unsentMessages}개 있어요. 지금 로그아웃하면 이 음성 메시지는 학습 짝에게 가지 않고 사라져요.</p>}
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
          // 공용 기기에 계정 사본을 남기지 않는다 (010 FR-009).
          else sync.forget(userId);
        }}>로그아웃</button>
      </div>
    </div>}
  </>;
}
