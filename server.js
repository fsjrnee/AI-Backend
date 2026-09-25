import "dotenv/config";

import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPublicCharacterOptions } from "./src/game/content.js";
import { GameEngine, GameError } from "./src/game/engine.js";
import { narrateTurn } from "./src/game/narrator.js";
import { AiServiceError, getAiReply } from "./src/services/aiService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ chatService = getAiReply, gameEngine } = {}) {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const activeGameEngine = gameEngine || new GameEngine({
    narrator: (context) => narrateTurn({ ...context, chatService }),
  });

  app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, game: "무림초행" });
  });

  app.get("/api/game/options", (_request, response) => {
    response.json({ options: getPublicCharacterOptions() });
  });

  app.post("/api/game/start", async (request, response) => {
    try {
      const result = await activeGameEngine.start(request.body?.character || {});
      return response.status(201).json(result);
    } catch (error) {
      return handleApiError(error, response);
    }
  });

  app.get("/api/game/state/:sessionId", (request, response) => {
    try {
      return response.json(activeGameEngine.inspect(request.params.sessionId));
    } catch (error) {
      return handleApiError(error, response);
    }
  });

  app.post("/api/game/action", async (request, response) => {
    const sessionId = request.body?.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return response.status(400).json({ error: "게임 세션 ID가 필요합니다." });
    }

    try {
      const result = await activeGameEngine.act(sessionId, {
        message: request.body?.message,
        choiceId: request.body?.choiceId,
      });
      return response.json(result);
    } catch (error) {
      return handleApiError(error, response);
    }
  });

  app.post("/api/chat", async (request, response) => {
    const message = request.body?.message;

    if (typeof message !== "string" || message.trim().length === 0) {
      return response.status(400).json({ error: "메시지를 입력해 주세요." });
    }

    try {
      if (typeof request.body?.sessionId === "string") {
        const result = await activeGameEngine.act(request.body.sessionId, {
          message,
          choiceId: request.body?.choiceId,
        });
        return response.json(result);
      }
      const reply = await chatService(message.trim());
      return response.json({ reply });
    } catch (error) {
      return handleApiError(error, response);
    }
  });

  app.use((error, _request, response, next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({ error: "올바른 JSON 요청이 아닙니다." });
    }

    return next(error);
  });

  return app;
}

function handleApiError(error, response) {
  if (error instanceof AiServiceError || error instanceof GameError) {
    console.error(`[${error.name}] ${error.code}: ${error.message}`);
    return response.status(error.statusCode).json({ error: error.message, code: error.code });
  }

  console.error("[Server] 예상하지 못한 오류:", error);
  return response.status(500).json({ error: "서버에서 오류가 발생했습니다." });
}

export function startServer(port = Number(process.env.PORT) || 3000) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`무림초행이 http://localhost:${port} 에서 실행 중입니다.`);
  });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  startServer();
}

