# Talklog

친구와 비동기 음성 메시지를 주고받으며 외국어 표현을 자연스럽게 학습하는 모바일 우선 프로토타입입니다.

대화 중 들은 음성을 확인하고, 스크립트와 번역을 필요할 때만 열어본 뒤, AI가 다듬은 표현을 플래시카드로 저장하고 복습하는 흐름을 검증하기 위해 제작했습니다.

## 주요 기능

- 진행 중인 학습방과 오늘의 복습 현황 확인
- 상대방과 내가 보낸 음성 메시지 UI
- 상대방 음성의 스크립트와 번역을 각각 독립적으로 열고 닫기
- 실제 음성 녹음(최대 60초)과 재생
- 보내기 전 미리 듣기·다시 녹음·취소, 명시적인 전송 단계
- 마이크 권한 거부·장치 없음·미지원 상황별 안내
- STT 결과와 자연스러운 문장을 비교하는 AI 피드백 화면
- 대화에서 발견한 표현을 플래시카드로 저장
- 저장한 표현 목록과 카드 복습
- 모바일 우선 반응형 레이아웃 및 키보드 접근성 속성

## 사용자 흐름

```text
홈
 ├─ 진행 중인 학습방
 │   └─ 음성 메시지 확인
 │       ├─ 스크립트 토글
 │       ├─ 번역 토글
 │       ├─ 음성 답장 녹음
 │       │   └─ 미리 듣기 → 다시 녹음 / 전송
 │       └─ AI 피드백
 │           └─ 표현 저장
 │               └─ 플래시카드
 └─ 오늘의 복습
     └─ 카드 뒤집기
         └─ 기억 여부 선택
```

## 기술 스택

- Next.js 15
- React 19
- TypeScript 5
- Tailwind CSS 4
- MediaRecorder · getUserMedia (브라우저 표준 API, 추가 의존성 없음)
- CSS 기반 반응형 UI

## 시작하기

### 요구 사항

- Node.js 20 이상
- npm

### 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인합니다.

Windows PowerShell의 실행 정책으로 `npm` 명령이 차단될 경우 다음처럼 실행할 수 있습니다.

```powershell
npm.cmd install
npm.cmd run dev
```

### 프로덕션 빌드

```bash
npm run build
npm run start
```

## Vercel 배포

Git 저장소를 Vercel에 연결한 뒤 프로젝트를 가져오면 Next.js 설정이 자동으로 감지됩니다. 별도의 환경 변수나 빌드 설정은 현재 필요하지 않습니다.

Vercel CLI를 사용하는 경우에는 프로젝트 루트에서 다음 명령을 실행합니다.

```bash
npx vercel
```

공개 배포 전에는 `package.json`의 Next.js를 최신 보안 패치 버전으로 올리고 빌드 결과를 다시 확인하는 것을 권장합니다.

## 프로젝트 구조

```text
talklog/
├─ app/
│  ├─ globals.css       # 전체 스타일과 반응형 레이아웃
│  ├─ layout.tsx        # 문서 레이아웃과 메타데이터
│  ├─ page.tsx          # 화면, 상태 및 사용자 상호작용
│  ├─ components/       # Recorder, VoiceBubble
│  ├─ hooks/            # useVoiceRecorder, useVoicePlayback
│  └─ lib/              # 공유 타입과 오디오 유틸리티
├─ specs/               # 기능별 명세·계획·작업 (spec-driven development)
├─ .specify/            # spec-kit 설정과 프로젝트 헌법
├─ draft.md             # 프로토타입 기획 초안
├─ package.json
├─ postcss.config.mjs
└─ tsconfig.json
```

## 현재 구현 범위

이 프로젝트는 사용자 흐름을 검증하기 위한 프론트엔드 프로토타입입니다. 음성 녹음과 재생은 실제로 동작하지만, 녹음 결과는 브라우저 메모리에만 있어 새로고침하면 사라집니다. 그 밖의 콘텐츠는 로컬 Mock 데이터입니다. 대화에 미리 놓인 예시 음성 메시지는 재생할 소리가 없으므로 재생 버튼이 비활성으로 표시됩니다.

다음 기능은 화면과 상태 전환만 구현되어 있고 실제 서비스와 연동되지 않았습니다.

- 회원가입과 로그인
- 음성 파일 업로드와 서버 보관
- STT 변환
- AI 문장 교정과 번역
- 플래시카드 영구 저장
- 알림, 친구 초대 및 실시간 통신
- API, 서버 및 데이터베이스

## 향후 확장 방향

1. 화면별 컴포넌트와 라우트 분리
2. STT·번역·문장 교정 API 연동
3. 사용자 및 학습 기록 저장
4. 남은 화면의 빈 상태, 처리 중, 실패 상태 보강
5. 접근성·반응형·사용자 테스트 자동화

## 기획 문서

상세 사용자 시나리오와 검증 기준은 [`draft.md`](./draft.md)를 참고하세요.

기능별 명세는 [`specs/`](./specs/)에 있습니다. 프로젝트 원칙은 [`.specify/memory/constitution.md`](./.specify/memory/constitution.md)에 정의돼 있습니다.
