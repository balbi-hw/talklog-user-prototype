"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { UseAccountResult } from "./useAccount";
import { getRecordScope, subscribeRecordScope, type RecordScope } from "../lib/record-scope";
import {
  clearAccountCopy, deviceSummary, getSyncStatus, importDeviceRecords, pendingCount, retrySync,
  startAccountRecords, subscribeSyncStatus, switchToDeviceRecords, wasImportHandled,
  type DeviceSummary, type ImportResult, type SyncStatus,
} from "../lib/record-sync";

const SERVER_STATUS: SyncStatus = { state: "idle", pending: 0, rejected: 0 };
const SERVER_SCOPE: RecordScope = { kind: "pending" };

/** specs/010-account-records/contracts/use-record-sync.md */
export type UseRecordSyncResult = {
  scope: RecordScope;
  status: SyncStatus;
  /** 로그인 직후 한 번 묻는 기기 기록 가져오기. null 이면 묻지 않는다. */
  importOffer: DeviceSummary | null;
  /** 계정 화면에서 언제든 가져올 수 있도록 지금 기기 기록 수를 준다. */
  device: DeviceSummary;
  importNow: () => ImportResult;
  dismissImport: () => void;
  retry: () => void;
  pendingFor: (userId: string) => number;
  /** 사용자가 로그아웃한 뒤 이 기기의 계정 사본을 지운다. */
  forget: (userId: string) => void;
};

export function useRecordSync(account: UseAccountResult): UseRecordSyncResult {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, () => SERVER_STATUS);
  const scope = useSyncExternalStore(subscribeRecordScope, getRecordScope, () => SERVER_SCOPE);
  const [importOffer, setImportOffer] = useState<DeviceSummary | null>(null);
  const [device, setDevice] = useState<DeviceSummary>({ rooms: 0, expressions: 0 });
  // "나중에"를 고르면 이번 로그인 동안은 다시 묻지 않는다. 다음 로그인 때 다시 묻는다.
  const dismissedFor = useRef<string | null>(null);

  const userId = account.state.status === "signed-in" ? account.state.user.id : null;

  useEffect(() => {
    if (account.state.status === "loading") return;
    if (userId) startAccountRecords(userId);
    else switchToDeviceRecords();
  }, [account.state.status, userId]);

  useEffect(() => {
    setDevice(deviceSummary());
    if (scope.kind !== "account" || !scope.loaded) { setImportOffer(null); return; }
    const summary = deviceSummary();
    if (wasImportHandled(scope.userId) || dismissedFor.current === scope.userId || summary.rooms + summary.expressions === 0) return;
    setImportOffer(summary);
  }, [scope]);

  useEffect(() => {
    if (!userId) return;
    const onBack = () => retrySync();
    window.addEventListener("online", onBack);
    window.addEventListener("focus", onBack);
    return () => { window.removeEventListener("online", onBack); window.removeEventListener("focus", onBack); };
  }, [userId]);

  const importNow = useCallback((): ImportResult => {
    if (!userId) return { ok: false, reason: "not-ready" };
    const result = importDeviceRecords(userId);
    if (result.ok) setImportOffer(null);
    setDevice(deviceSummary());
    return result;
  }, [userId]);

  const dismissImport = useCallback(() => {
    dismissedFor.current = userId;
    setImportOffer(null);
  }, [userId]);

  const forget = useCallback((id: string) => {
    clearAccountCopy(id);
    dismissedFor.current = null;
  }, []);

  return { scope, status, importOffer, device, importNow, dismissImport, retry: retrySync, pendingFor: pendingCount, forget };
}

