# 무림초행 — AI 채팅형 무협 RPG

브라우저에서 자유롭게 행동을 입력하면, 서버의 규칙 엔진이 결과와 상태 변화를 먼저 확정하고 외부 AI는 그 결과만 무협 장면으로 서술합니다. API 키와 비공개 게임 정보는 서버에만 있습니다.

## 구조

```text
브라우저 UI
  → Express 게임 API
  → 규칙 엔진(판정·전투·상태·기억)
  → Groq/OpenAI/Gemini(서술 전용)
  → 브라우저
```

AI가 능력치, 판정 결과, NPC의 비공개 지식이나 과거 사실을 임의로 바꾸지 못하도록 게임 상태와 판정을 코드가 관리합니다. AI 호출이 실패해도 규칙 기반 대체 문장으로 플레이를 이어 갑니다.

## 현재 플레이 범위

- 짧지만 이후 반응이 달라지는 캐릭터 생성
- 제시 선택지와 자유 입력을 함께 지원
- 공개 판정, 우세·불리, 성공/대가 있는 성공/실패/치명적 실패
- 거리·지형·자세·사기·비살상 선택이 있는 전투
- 단서, 목표, 관계, 세력 반응, 지연 결과 기록
- 반복 행동과 정체 신호를 감지하는 피로도 제어
- 첫 지역에서 이어지는 3개 장면의 플레이 가능한 수직 단면

전체 캠페인 설계와 구현 규칙은 [게임 설계 문서](docs/GAME_DESIGN.md)에 있습니다.

## 설치 및 실행

Node.js 18 이상이 필요합니다.

```bash
npm install
copy .env.example .env
npm start
```

`.env`에 사용할 제공사의 키를 설정합니다. 기본 제공사는 Groq입니다.

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=발급받은_키
```

브라우저에서 <http://localhost:3000>을 열어 인물을 만든 뒤 바로 플레이할 수 있습니다. `.env`는 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.

## 다른 AI 제공사

```dotenv
# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=발급받은_키

# 또는 Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=발급받은_키
```

`AI_PROVIDER`만 바꾸면 같은 게임 엔진을 유지한 채 서술 AI를 교체할 수 있습니다. 모델은 `GROQ_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`로 지정합니다.

## 게임 API

- `GET /api/health`: 서버 상태
- `GET /api/game/options`: 캐릭터 생성 선택지
- `POST /api/game/start`: 새 세션 생성
- `GET /api/game/state/:sessionId`: 공개 상태 조회
- `POST /api/game/action`: 선택지 또는 자유 행동 처리
- `POST /api/chat`: 기존 단순 AI 채팅 호환 경로

새 게임 예시:

```bash
curl -X POST http://localhost:3000/api/game/start \
  -H "Content-Type: application/json" \
  -d '{"character":{"name":"연우","origin":"border_refugee","past":"failed_rescue","talent":"keen_eye","tenet":"no_kill","bond":"herbalist_debt","martialPath":"flowing_sword","longGoal":"protect_route"}}'
```

응답의 `sessionId`로 행동합니다.

```bash
curl -X POST http://localhost:3000/api/game/action \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"발급된_ID","action":"수레바퀴 자국과 뱃사공들의 표정을 살핀다"}'
```

## 테스트

```bash
npm test
```

테스트는 게임 판정, 실패 후 진행, 반복 감지, 장면 전환, API 오류 처리와 공급사 응답 변환을 실제 과금 없이 검증합니다.

## 현재 제한

세션은 서버 메모리에 저장되므로 서버를 다시 시작하면 사라집니다. 첫 재미 검증 단계에서는 DB를 두지 않았습니다. 장기 캠페인으로 확장할 때 설계 문서의 상태 JSON을 파일 또는 DB에 저장하는 계층을 추가하면 됩니다.

