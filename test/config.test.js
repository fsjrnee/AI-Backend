import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("공개 환경 변수 예제에는 실제 키를 넣지 않는다", () => {
  const example = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const key of ["GROQ_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]) {
    const value = example.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1].trim();
    assert.equal(value === "", true, `${key} must stay empty in the public example`);
  }
});
