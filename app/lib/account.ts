/**
 * 계정 (Generic) — 로그인 상태·입력 검증·실패 문구 (specs/009-auth/data-model.md).
 * 로그인은 선택이다. 학습 기록은 로그인과 관계없이 이 기기에 남는다 (FR-006).
 */

export type AccountUser = { id: string; email: string; displayName: string };

/** `unavailable`: 이 환경에 Supabase 설정이 없다. 앱은 로그인 없이 그대로 동작한다. */
export type AccountState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: AccountUser };

export type AccountFailure =
  | "invalid-credentials"
  | "email-exists"
  | "email-not-confirmed"
  | "weak-password"
  | "invalid-email"
  | "rate-limited"
  | "signup-disabled"
  | "timeout"
  | "network"
  | "confirm-failed"
  | "unknown";

export type AccountResult =
  | { ok: true; outcome: "signed-in" | "confirmation-sent" | "signed-out" }
  | { ok: false; reason: AccountFailure };

export const ACCOUNT_FAILURE_MESSAGE: Record<AccountFailure, string> = {
  "invalid-credentials": "이메일이나 비밀번호가 맞지 않아요.",
  "email-exists": "이미 가입된 이메일이에요. 로그인해 주세요.",
  "email-not-confirmed": "아직 이메일 확인 전이에요. 받은 메일의 링크를 눌러 주세요.",
  "weak-password": "비밀번호가 너무 쉬워요. 6자 이상으로 더 안전하게 정해 주세요.",
  "invalid-email": "이 이메일 주소는 쓸 수 없어요. 다시 확인해 주세요.",
  "rate-limited": "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
  "signup-disabled": "지금은 새로 가입할 수 없어요.",
  timeout: "응답이 늦어지고 있어요. 연결을 확인하고 다시 시도해 주세요.",
  network: "연결할 수 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
  "confirm-failed": "확인 링크가 만료됐거나 이미 사용됐어요. 다시 로그인하거나 가입해 주세요.",
  unknown: "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
};

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;
export const DISPLAY_NAME_MAX = 20;
export const ACCOUNT_TIMEOUT_MS = 15_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => email.trim().length <= 254 && EMAIL_PATTERN.test(email.trim());
export const isValidPassword = (password: string) => password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
export const isValidDisplayName = (name: string) => {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= DISPLAY_NAME_MAX;
};

/** Supabase 오류를 화면 문구로 옮긴다. 제공자 원문 메시지는 화면에 내보내지 않는다 (FR-008). */
export function accountFailure(error: unknown): AccountFailure {
  if (!error || typeof error !== "object") return "unknown";
  const { code, status, name } = error as { code?: string; status?: number; name?: string };
  switch (code) {
    case "invalid_credentials": return "invalid-credentials";
    case "email_exists":
    case "user_already_exists": return "email-exists";
    case "email_not_confirmed": return "email-not-confirmed";
    case "weak_password": return "weak-password";
    case "email_address_invalid":
    case "email_address_not_authorized":
    case "validation_failed": return "invalid-email";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit": return "rate-limited";
    case "signup_disabled":
    case "email_provider_disabled": return "signup-disabled";
    case "request_timeout": return "timeout";
  }
  if (status === 429) return "rate-limited";
  if (name === "AuthRetryableFetchError" || status === 0) return "network";
  if (name === "TypeError") return "network";
  return "unknown";
}

/** 표시 이름이 없으면 이메일 앞부분을 쓴다. `user_metadata`는 사용자가 바꿀 수 있으므로 표시에만 쓴다. */
export function toAccountUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): AccountUser {
  const email = user.email ?? "";
  const raw = user.user_metadata?.display_name;
  const displayName = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, DISPLAY_NAME_MAX) : email.split("@")[0] || "학습자";
  return { id: user.id, email, displayName };
}

export function withTimeout<T>(promise: Promise<T>, ms = ACCOUNT_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject({ code: "request_timeout" }), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
