# AI Backend

브라우저 채팅 UI가 Node.js/Express 백엔드를 통해 외부 AI API를 호출하는 최소 예제입니다. API 키는 서버의 `.env`에서만 읽으며 브라우저 코드에는 포함하지 않습니다.

## 구조

```text
브라우저(public) → POST /api/chat → AI 서비스 → Groq/OpenAI/Gemini
```

기본 제공사는 무료 플랜 한도가 공개된 Groq입니다. `AI_PROVIDER`만 바꾸면 OpenAI 또는 Gemini를 사용할 수 있습니다.

## 설치 및 실행

Node.js 18 이상이 필요합니다.

```bash
npm install
copy .env.example .env
npm start
```

`.env`에 사용할 제공사의 API 키를 넣습니다.

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=발급받은_키
```

브라우저에서 <http://localhost:3000>을 열고 메시지를 보내면 됩니다.

## 다른 제공사 사용

```dotenv
# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=발급받은_키

# 또는 Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=발급받은_키
```

각 모델은 `GROQ_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`로 교체할 수 있습니다. 현재 기본 모델은 `.env.example`을 확인하세요.

## API 직접 테스트

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"안녕"}'
```

성공 응답:

```json
{ "reply": "안녕하세요!" }
```

API 키가 없으면 `503`, 빈 메시지는 `400`, 외부 AI 장애는 `502` 또는 시간 초과 시 `504`를 반환합니다.

## 테스트

```bash
npm test
```

공급사 응답 변환은 실제 과금 없이 모의 응답으로 검증합니다. 실제 AI 호출은 `.env`에 유효한 키를 설정한 뒤 브라우저나 위의 `curl` 명령으로 확인할 수 있습니다.


