import "dotenv/config";

import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AiServiceError, getAiReply } from "./src/services/aiService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ chatService = getAiReply } = {}) {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN?.trim();

  app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/api/chat", async (request, response) => {
    const message = request.body?.message;

    if (typeof message !== "string" || message.trim().length === 0) {
      return response.status(400).json({ error: "메시지를 입력해 주세요." });
    }

    try {
      const reply = await chatService(message.trim());
      return response.json({ reply });
    } catch (error) {
      if (error instanceof AiServiceError) {
        console.error(`[AI] ${error.code}: ${error.message}`);
        return response.status(error.statusCode).json({ error: error.message });
      }

      console.error("[AI] 예상하지 못한 오류:", error);
      return response.status(500).json({ error: "서버에서 오류가 발생했습니다." });
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

export function startServer(port = Number(process.env.PORT) || 3000) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`AI Backend가 http://localhost:${port} 에서 실행 중입니다.`);
  });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  startServer();
}


