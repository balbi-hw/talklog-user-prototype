"use client";

import { useEffect, useRef, useState } from "react";
import type { UseRecordSyncResult } from "../hooks/useRecordSync";
import type { ImportResult } from "../lib/record-sync";

/** 계정 기록 상태 한 줄 (010 FR-007). 계정 화면과 상단 알림이 같은 문구를 쓴다. */
export function syncMessage(sync: UseRecordSyncResult): { text: string; tone: "done" | "busy" | "warn"; retry: boolean } | null {
  const { scope, status } = sync;
  if (scope.kind !== "account") return null;
  if (!scope.loaded) {
    if (status.state === "offline") return { text: "연결이 없어 계정 기록을 받아 오지 못했어요.", tone: "warn", retry: true };
    if (status.state === "error") return { text: "계정 기록을 받아 오지 못했어요.", tone: "warn", retry: true };
    return { text: "계정 기록을 받아 오고 있어요.", tone: "busy", retry: false };
  }
  if (status.state === "offline") {
    return { text: status.pending ? `연결되면 보낼 변경이 ${status.pending}건 있어요. 이 기기에는 저장됐어요.` : "연결이 끊겼어요. 다시 연결되면 최신 기록을 받아 와요.", tone: "warn", retry: true };
  }
  if (status.state === "error") {
    return { text: status.pending ? `계정에 보내지 못한 변경이 ${status.pending}건 있어요. 이 기기에는 저장됐어요.` : "계정 기록을 새로 받아 오지 못했어요.", tone: "warn", retry: true };
  }
  if (status.rejected) {
    return { text: `계정에 저장할 수 없는 변경이 ${status.rejected}건 있어요. 이 기기에만 남아 있어요.`, tone: "warn", retry: false };
  }
  if (status.state === "syncing" || status.pending) return { text: "계정에 보내고 있어요.", tone: "busy", retry: false };
  if (status.state === "loading") return { text: "계정 기록을 받아 오고 있어요.", tone: "busy", retry: false };
  return { text: "기록이 계정에 저장돼 있어요.", tone: "done", retry: false };
}

/** 상단 바 아래 알림. 문제가 있거나 처음 받아 오는 동안만 보인다. */
export function RecordSyncBanner({ sync }: { sync: UseRecordSyncResult }) {
  const message = syncMessage(sync);
  if (!message || message.tone === "done") return null;
  if (message.tone === "busy" && sync.scope.kind === "account" && sync.scope.loaded) return null;
  return <div className={`sync-banner ${message.tone}`} role="status">
    <p>{message.text}</p>
    {message.retry && <button type="button" onClick={sync.retry}>다시 시도</button>}
  </div>;
}

/** 로그인 직후 한 번 묻는다 (010 FR-004). */
export function ImportDialog({ sync }: { sync: UseRecordSyncResult }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [open, setOpen] = useState(false);
  const firstButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (sync.importOffer && !open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setResult(null);
      setOpen(true);
    }
  }, [sync.importOffer, open]);
  useEffect(() => { if (open) firstButton.current?.focus(); }, [open, result]);

  if (!open) return null;
  const close = () => {
    if (!result?.ok) sync.dismissImport();
    setOpen(false);
    requestAnimationFrame(() => returnFocus.current?.focus?.());
  };
  const offer = sync.importOffer;

  return <div className="leave-confirm" role="dialog" aria-modal="true" aria-labelledby="import-title"
    onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
    <div className="leave-card">
      {result?.ok ? <>
        <strong id="import-title">계정으로 가져왔어요</strong>
        <p>학습방 {result.rooms}개, 표현 {result.expressions}개를 가져왔어요.
          {result.skipped > 0 && ` 이미 계정에 있던 ${result.skipped}개는 건너뛰었어요.`} 이 기기의 기록은 그대로 남아요.</p>
        <div className="leave-actions"><button ref={firstButton} type="button" onClick={close}>확인</button></div>
      </> : <>
        <strong id="import-title">이 기기의 기록을 계정으로 가져올까요?</strong>
        <p>이 기기에 학습방 {offer?.rooms ?? 0}개, 표현 {offer?.expressions ?? 0}개가 있어요. 가져오면 다른 기기에서 로그인해도 보여요.
          계정에 이미 있는 학습방·표현은 건너뛰어요.</p>
        {result && !result.ok && <p className="room-notice" role="alert">
          {result.reason === "not-ready" ? "계정 기록을 아직 받아 오지 못했어요. 잠시 뒤 다시 시도해 주세요." : "기록을 읽거나 쓰지 못했어요. 브라우저 저장소 설정을 확인해 주세요."}
        </p>}
        <div className="leave-actions">
          <button ref={firstButton} type="button" onClick={() => setResult(sync.importNow())}>가져오기</button>
          <button type="button" className="leave-discard" onClick={close}>나중에</button>
        </div>
      </>}
    </div>
  </div>;
}
