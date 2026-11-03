# Implementation Plan: 학습 짝 초대와 음성 메시지 주고받기

**Branch**: `011-partner-messages` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

## Summary
010 의 사용자별 `rooms` 는 그대로 두고, 함께 쓰는 학습방 정보(`shared_rooms`)와 초대 코드·음성 메시지를 새 테이블에 둔다. 코드 만들기·들어오기·나가기는 Postgres 함수로 한 트랜잭션 안에서 처리한다. 소리는 Storage 비공개 버킷에 올리고 서명 주소로 재생한다. 새 메시지는 Realtime Postgres Changes 로 받고, 연결 복구·창 복귀·학습방 열기 때 빠진 것을 받아 온다. 로그아웃·키 없음·예시 학습방은 지금의 메모리 경로 그대로다.

## Technical Context
- **언어·프레임워크**: TypeScript 5 strict, React 19, Next.js 15 App Router.
- **의존성**: 추가 0. `@supabase/supabase-js` 2.118 의 `rpc`·`storage`·`channel` 을 쓴다.
- **저장**:
  - Postgres 새 테이블 4개(`shared_rooms`·`invite_codes`·`invite_attempts`·`voice_messages`), 함수 7개(`is_shared_room_member` 포함), Storage 버킷 1개, publication 2테이블.
  - localStorage 새 키는 0개다.
- **시간 상한**: 함수·조회·넣기 15초, 올리기 30초. 실시간이 끊기면 15초 뒤 다시 연결한다.
- **검증**: 키 있는·없는 build. 가짜 Auth·PostgREST·Storage·Realtime(Playwright `routeWebSocket`)으로 두 문맥을 돌린다. 실제 DB 는 사용자가 마이그레이션을 적용한 뒤 두 계정으로 확인한다.
- **규모**: 학습방당 사람 둘, 메시지 최근 500개, 소리 하나 5MB 이하.

## Constitution Check
| 원칙 | 설계 전 | 설계 후 근거 |
| --- | --- | --- |
| I | PASS | 대화·학습 관계 서브도메인. 흐름 2·4·5·6·9. 용어집에 "초대 코드" 추가. 식별자 `room`·`partner`·`VoiceMessage`·`inviteCode` |
| II | PASS | 예시 학습방·예시 메시지는 그대로 예시로 표시. 로그아웃 상태의 초대 자리는 로그인 안내로 둔다(동작하는 척하지 않음). 010 의 "녹음은 올라가지 않아요" 문구를 사실에 맞게 바꾼다. README 미구현 목록에서 초대·수신을 뺀다 |
| III | PASS | 코드 입력 확인 대화상자의 포커스·Escape, 복사 결과·전송 상태·연결 상태 `role="status"`, 아이콘 버튼 `aria-label` |
| IV | PASS | 추가 의존성 0. Supabase 클라이언트는 승인된 범주 |
| V | PASS | 코드 만들기·입력·보내기·받기·나가기 모두 처리 중·성공·실패·시간 초과·네트워크 끊김 정의. 실패한 녹음은 남고 다시 보낼 수 있다. 나가기는 확인 단계. 실시간이 끊겨도 재생·녹음은 된다 |
| VI | 해당 없음 | AI 경계 변경 없음. 학습 짝 메시지도 007 인터페이스로 스크립트·번역을 요청한다 |
| 기술 제약: RLS | PASS | 4테이블 RLS on. `invite_codes`·`invite_attempts` 는 정책 없이 함수로만. Storage 정책은 버킷·경로·멤버 한정. anon 권한 없음 |
| 기술 제약: 비밀 | PASS | publishable key 만. 함수는 `security definer` + `search_path = ''` |
| 기술 제약: 키 없는 빌드 | PASS | `enabled` false, 메모리 경로 |
| 기술 제약: 브라우저 저장소 | PASS | 새 키 없음. 010 이전 메모리 녹음은 옮기지 않음(spec Assumptions) |

## Project Structure
- `supabase/migrations/20261103010000_partner_messages.sql`: 테이블·인덱스·RLS·함수·Storage 버킷과 정책·publication·권한.
- `app/lib/partner.ts`: 타입, 코드 정규화·검사, 실패 문구, 메시지 합치기·정렬, 서버 행 → `VoiceMessage` 변환. 순수 함수.
- `app/lib/partner-client.ts`: Supabase 호출(rpc·select·insert·storage·channel)과 시간 상한. 화면은 이 파일을 직접 쓰지 않는다.
- `app/hooks/usePartnerRooms.ts`: contracts/use-partner-rooms.md.
- `app/components/RoomInvite.tsx`: 학습방 안 초대 코드 영역(만들기·복사·취소·새로 만들기, 학습 짝 이름, 로그인 안내).
- `app/components/InviteJoin.tsx`: 학습방 목록의 코드 입력과 확인 대화상자.
- `app/components/RoomList.tsx`: 코드 입력 자리, 학습 짝이 있는 학습방의 나가기 확인 문구.
- `app/components/VoiceBubble.tsx`: `delivery` 표시, 다시 보내기·지우기.
- `app/page.tsx`: 서버 메시지와 메모리 메시지 고르기, 학습 짝 메시지 렌더(재생·스크립트·번역·표현 저장), 닫힌 학습방 안내, 연결 안내, 떠나기 확인에 보내는 중 포함, 학습방 이름 대체.
- `app/components/AccountScreen.tsx`: 로그인 안내 문구(FR-015).
- `app/globals.css`, `README.md`, `docs/product-plan.md`: 스타일과 구현 범위.

## Complexity Tracking
- **`security definer` 함수 6개**: 들어오려는 사람은 RLS 로 코드를 볼 수 없다. 코드 사용과 학습 짝 지정이 한 트랜잭션이어야 한다. 함수마다 `auth.uid()` 를 확인하고 `search_path` 를 비운다. 실행 권한은 `authenticated` 에만 준다.
- **학습 짝 쪽 `rooms` 행 복제**: 목록·홈 요약·010 동기화를 그대로 쓰기 위해서다. 두 원본이 어긋나는 경우는 research R1 의 복구 규칙으로 맞춘다.
- **소리 지우기는 클라이언트가 한다**: Storage 객체는 SQL 로 지울 수 없다. 실패하면 멤버가 없는 고아 객체가 남지만 아무도 읽을 수 없다.
